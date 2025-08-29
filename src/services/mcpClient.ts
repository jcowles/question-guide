export interface MCPClientConfig {
  baseUrl: string;
  apiKey?: string;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface MCPResource {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
}

export interface MCPProgress {
  progressToken: string;
  progress?: {
    status?: string;
    completed?: number;
    total?: number;
    credits_used?: number;
  };
  events?: Array<{
    type: string;
    timestamp: string;
    data?: any;
  }>;
  lines_tail?: string[];
}

export interface MCPSession {
  sessionId: string;
  protocolVersion: string;
  capabilities: {
    tools?: { listChanged?: boolean };
    resources?: { subscribe?: boolean; listChanged?: boolean };
    logging?: { setLevel?: boolean };
  };
  serverInfo: {
    name: string;
    version: string;
  };
}

export interface MCPProgressCallback {
  (progress: MCPProgress): void;
}

export class MCPClient {
  private config: MCPClientConfig;
  private session: MCPSession | null = null;
  private sseConnection: EventSource | null = null;
  private progressCallbacks = new Map<string, MCPProgressCallback>();
  private tools: MCPTool[] = [];
  private requestId = 1;

  constructor(config: MCPClientConfig) {
    this.config = config;
  }

  async initialize(): Promise<MCPSession> {
    const response = await this.makeRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {},
        resources: { subscribe: true },
        logging: {}
      },
      clientInfo: {
        name: 'Lovable MCP Client',
        version: '1.0.0'
      }
    });

    if (!response.result) {
      throw new Error('Initialize failed: No result in response');
    }

    const sessionId = response.headers?.['mcp-session-id'];
    const protocolVersion = response.headers?.['mcp-protocol-version'];

    if (!sessionId || !protocolVersion) {
      throw new Error('Initialize failed: Missing session headers');
    }

    this.session = {
      sessionId,
      protocolVersion,
      capabilities: response.result.capabilities || {},
      serverInfo: response.result.serverInfo || { name: 'Unknown', version: '1.0.0' }
    };

    // Start SSE connection
    await this.startSSEConnection();

    // Discover available tools
    await this.discoverTools();

    return this.session;
  }

  private async startSSEConnection(): Promise<void> {
    if (!this.session) throw new Error('Session not initialized');

    const url = new URL(this.config.baseUrl);
    
    this.sseConnection = new EventSource(url.toString(), {
      // Note: EventSource doesn't support custom headers, so we'll use query params
      // This is a limitation we'll need to handle server-side
    });

    this.sseConnection.addEventListener('jsonrpc', (event) => {
      try {
        const notification = JSON.parse(event.data);
        this.handleNotification(notification);
      } catch (error) {
        console.error('Failed to parse SSE notification:', error);
      }
    });

    this.sseConnection.onerror = (error) => {
      console.error('SSE connection error:', error);
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('SSE connection timeout'));
      }, 5000);

      this.sseConnection!.onopen = () => {
        clearTimeout(timeout);
        resolve();
      };
    });
  }

  private handleNotification(notification: any): void {
    if (notification.method === 'notifications/progress') {
      const { progressToken, progress, events, lines_tail } = notification.params;
      const callback = this.progressCallbacks.get(progressToken);
      
      if (callback) {
        callback({
          progressToken,
          progress,
          events,
          lines_tail
        });
      }
    }
  }

  private async discoverTools(): Promise<void> {
    const response = await this.makeRequest('tools/list', {});
    this.tools = response.result?.tools || [];
  }

  async getTools(): Promise<MCPTool[]> {
    return this.tools;
  }

  async callTool(name: string, arguments_: Record<string, any>): Promise<any> {
    const response = await this.makeRequest('tools/call', {
      name,
      arguments: arguments_
    });

    return response.result;
  }

  async readResource(uri: string, progressToken?: string): Promise<any> {
    const params: any = { uri };
    if (progressToken) {
      params._meta = { progressToken };
    }

    const response = await this.makeRequest('resources/read', params);
    return response.result;
  }

  async subscribeToResource(uri: string, progressToken: string): Promise<void> {
    await this.makeRequest('resources/subscribe', {
      uri,
      progressToken
    });
  }

  async unsubscribeFromResource(uri: string, progressToken: string): Promise<void> {
    await this.makeRequest('resources/unsubscribe', {
      uri,
      progressToken
    });
  }

  registerProgressCallback(progressToken: string, callback: MCPProgressCallback): void {
    this.progressCallbacks.set(progressToken, callback);
  }

  unregisterProgressCallback(progressToken: string): void {
    this.progressCallbacks.delete(progressToken);
  }

  generateProgressToken(): string {
    return `progress-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  async setLogLevel(level: 'debug' | 'info' | 'warning' | 'error' | 'critical'): Promise<void> {
    await this.makeRequest('logging/setLevel', { level });
  }

  private async makeRequest(method: string, params: any): Promise<any> {
    const requestId = this.requestId++;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream'
    };

    if (this.session) {
      headers['Mcp-Session-Id'] = this.session.sessionId;
      headers['MCP-Protocol-Version'] = this.session.protocolVersion;
    }

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    console.log('MCP Request:', {
      url: this.config.baseUrl,
      method,
      headers,
      body: {
        jsonrpc: '2.0',
        id: requestId,
        method,
        params
      }
    });

    const response = await fetch(this.config.baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: requestId,
        method,
        params
      })
    });

    console.log('MCP Response:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('MCP Error Response:', errorText);
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`JSON-RPC Error ${data.error.code}: ${data.error.message}`);
    }

    // Return response with headers for initialize method
    return {
      result: data.result,
      headers: method === 'initialize' ? {
        'mcp-session-id': response.headers.get('mcp-session-id'),
        'mcp-protocol-version': response.headers.get('mcp-protocol-version')
      } : undefined
    };
  }

  disconnect(): void {
    if (this.sseConnection) {
      this.sseConnection.close();
      this.sseConnection = null;
    }
    this.session = null;
    this.progressCallbacks.clear();
  }

  isConnected(): boolean {
    return this.session !== null && this.sseConnection?.readyState === EventSource.OPEN;
  }
}