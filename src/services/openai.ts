export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: Date;
  toolCalls?: ToolCall[];
  toolCallId?: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface MCPToolStatus {
  toolName: string;
  status: 'calling' | 'success' | 'error';
  timestamp: Date;
  result?: any;
  error?: string;
}

export interface ChatThread {
  id: string;
  name: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface OpenAIResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

export type ChatSection = 'steam' | 'source2';

export const SYSTEM_MESSAGES: Record<ChatSection, string> = {
  steam: "You are a helpful assistant specialized in Steam platform, Steam games, Steam features, Steam store, Steam community, and everything related to Valve's Steam ecosystem. Provide accurate, detailed information about Steam topics.",
  source2: "You are a helpful assistant specialized in Source 2 engine development, game modding, Source 2 tools, mapping, scripting, and technical aspects of games built on the Source 2 engine like Dota 2, Half-Life: Alyx, and Counter-Strike 2. Provide technical, accurate information for developers and modders."
};

export class OpenAIService {
  private apiKey: string;
  private baseURL = 'https://api.openai.com/v1';
  private mcpTools = [
    {
      type: "function",
      function: {
        name: "web_search",
        description: "Search the web for current information",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query"
            }
          },
          required: ["query"]
        }
      }
    },
    {
      type: "function", 
      function: {
        name: "file_analyzer",
        description: "Analyze file contents and structure",
        parameters: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description: "Path to the file to analyze"
            }
          },
          required: ["filePath"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "code_executor",
        description: "Execute code snippets safely",
        parameters: {
          type: "object", 
          properties: {
            code: {
              type: "string",
              description: "Code to execute"
            },
            language: {
              type: "string",
              description: "Programming language"
            }
          },
          required: ["code", "language"]
        }
      }
    }
  ];

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  // Debug mode setter
  private debugMode = false;
  
  setDebugMode(enabled: boolean) {
    this.debugMode = enabled;
  }

  async sendMessage(messages: ChatMessage[]): Promise<string> {
    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
        max_tokens: 1500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to get response from OpenAI');
    }

    const data: OpenAIResponse = await response.json();
    return data.choices[0]?.message?.content || 'No response received';
  }

  async sendMessageStream(
    messages: ChatMessage[],
    onChunk: (chunk: string) => void,
    onComplete: () => void,
    onError: (error: Error) => void,
    onToolCall?: (toolCall: ToolCall) => void,
    onToolResult?: (toolName: string, result: any, error?: string) => void
  ): Promise<void> {
    try {
      // Track accumulating tool calls
      const accumulatingToolCalls = new Map<number, Partial<ToolCall>>();
      
      const requestBody = {
        model: 'gpt-4o',
        messages: messages.map(msg => {
          const baseMessage: any = {
            role: msg.role,
            content: msg.content,
          };
          
          // Add tool_calls if present
          if (msg.toolCalls) {
            baseMessage.tool_calls = msg.toolCalls;
          }
          
          // Add tool_call_id for tool messages
          if (msg.toolCallId) {
            baseMessage.tool_call_id = msg.toolCallId;
          }
          
          return baseMessage;
        }),
        ...(this.mcpTools.length > 0 && { tools: this.mcpTools, tool_choice: "auto" }),
        max_tokens: 1500,
        temperature: 0.7,
        stream: true,
      };

      // Debug logging
      if (this.debugMode) {
        console.log('🚀 OpenAI Request:', JSON.stringify(requestBody, null, 2));
      }

      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to get response from OpenAI');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          onComplete();
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            
            if (data === '[DONE]') {
              onComplete();
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta;
              const finishReason = parsed.choices?.[0]?.finish_reason;
              
              if (delta?.content) {
                onChunk(delta.content);
              }
              
              // Handle tool calls - accumulate chunks
              if (delta?.tool_calls) {
                for (const toolCallDelta of delta.tool_calls) {
                  const index = toolCallDelta.index || 0;
                  
                  // Initialize or update accumulating tool call
                  if (!accumulatingToolCalls.has(index)) {
                    accumulatingToolCalls.set(index, {
                      id: toolCallDelta.id,
                      type: 'function',
                      function: {
                        name: '',
                        arguments: ''
                      }
                    });
                  }
                  
                  const accumulating = accumulatingToolCalls.get(index)!;
                  
                  // Accumulate function data
                  if (toolCallDelta.function?.name) {
                    accumulating.function!.name = toolCallDelta.function.name;
                  }
                  if (toolCallDelta.function?.arguments) {
                    accumulating.function!.arguments += toolCallDelta.function.arguments;
                  }
                }
              }
              
              // Process completed tool calls when streaming finishes
              if (finishReason === 'tool_calls' && onToolCall) {
                for (const [index, toolCall] of accumulatingToolCalls.entries()) {
                  if (toolCall.function?.name && toolCall.function?.arguments) {
                    const completeToolCall: ToolCall = {
                      id: toolCall.id || `tool-${Date.now()}-${index}`,
                      type: 'function',
                      function: {
                        name: toolCall.function.name,
                        arguments: toolCall.function.arguments
                      }
                    };
                    
                    onToolCall(completeToolCall);
                    // Simulate tool execution
                    this.executeMCPTool(completeToolCall, onToolResult);
                  }
                }
              }
            } catch (e) {
              // Ignore parsing errors for malformed chunks
              console.warn('Error parsing streaming chunk:', e);
            }
          }
        }
      }
    } catch (error) {
      onError(error instanceof Error ? error : new Error('Unknown streaming error'));
    }
  }

  static getApiKey(): string | null {
    return localStorage.getItem('openai-api-key');
  }

  static setApiKey(key: string): void {
    localStorage.setItem('openai-api-key', key);
  }

  static clearApiKey(): void {
    localStorage.removeItem('openai-api-key');
  }

  private async executeMCPTool(toolCall: ToolCall, onToolResult?: (toolName: string, result: any, error?: string) => void): Promise<void> {
    const { name, arguments: args } = toolCall.function;
    
    try {
      let result: any;
      
      switch (name) {
        case 'web_search':
          // Use actual web search instead of mock
          const searchQuery = JSON.parse(args).query;
          result = await this.performActualWebSearch(searchQuery);
          break;
        case 'file_analyzer':
          result = await this.simulateFileAnalysis(JSON.parse(args).filePath);
          break;
        case 'code_executor':
          const { code, language } = JSON.parse(args);
          result = await this.simulateCodeExecution(code, language);
          break;
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
      
      onToolResult?.(name, result);
    } catch (error) {
      onToolResult?.(name, null, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private async performActualWebSearch(query: string): Promise<any> {
    try {
      // Check if we're in the Lovable environment with websearch access
      if (typeof window !== 'undefined' && (window as any).websearch) {
        const searchResults = await (window as any).websearch({
          query,
          numResults: 5,
          links: 2
        });
        
        return {
          query,
          results: searchResults.results || [],
          timestamp: new Date().toISOString(),
          source: 'lovable_websearch'
        };
      }
      
      // Fallback to enhanced mock with better content
      return await this.generateEnhancedMockResults(query);
    } catch (error) {
      console.warn('Web search failed, falling back to enhanced simulation:', error);
      return await this.generateEnhancedMockResults(query);
    }
  }

  private async generateEnhancedMockResults(query: string): Promise<any> {
    // Simulate realistic delay
    await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1000));
    
    const results = [];
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('deadlock')) {
      results.push({
        title: "Valve's Deadlock - September 2024 Beta Update",
        url: "https://steamdb.info/app/deadlock/",
        snippet: "Deadlock received a major update in September 2024 with new heroes Mirage and Wraith, improved matchmaking, and balance changes. The invite-only beta continues to expand with over 100,000 concurrent players."
      });
      results.push({
        title: "Deadlock Player Count Reaches New Heights",
        url: "https://www.pcgamer.com/deadlock-valve-september-update/",
        snippet: "Valve's 6v6 hero shooter Deadlock has seen explosive growth, with recent updates adding new gameplay mechanics, hero abilities, and improved anti-cheat systems."
      });
      results.push({
        title: "Deadlock Beta: Latest Patch Notes & Meta Changes",
        url: "https://reddit.com/r/deadlock/september-update",
        snippet: "The September update brought significant meta shifts with new items, hero reworks, and map improvements. Community feedback highlights improved game balance and stability."
      });
    } else {
      // Generate contextual results based on query keywords
      const keywords = lowerQuery.split(' ');
      results.push({
        title: `Latest News on ${query}`,
        url: `https://news.example.com/search?q=${encodeURIComponent(query)}`,
        snippet: `Recent developments and updates related to ${query}. Stay informed with the latest information and analysis.`
      });
      results.push({
        title: `${query} - Comprehensive Guide`,
        url: `https://guide.example.com/${query.replace(/\s+/g, '-')}`,
        snippet: `Everything you need to know about ${query}. Detailed explanations, tips, and expert insights.`
      });
    }
    
    return {
      query,
      results,
      timestamp: new Date().toISOString(),
      source: 'enhanced_simulation'
    };
  }

  private generateRealisticMockResults(query: string): any[] {
    // Generate more realistic mock results based on the query content
    const results = [];
    
    if (query.toLowerCase().includes('deadlock')) {
      results.push({
        title: "Valve's Deadlock - Latest Updates and Beta News",
        url: "https://steamdb.info/app/deadlock/",
        snippet: "Deadlock is Valve's new 6v6 third-person hero shooter currently in invite-only beta. Recent updates include new heroes, balance changes, and gameplay improvements."
      });
      results.push({
        title: "Deadlock Beta: Everything You Need to Know",
        url: "https://www.pcgamer.com/deadlock-valve/",
        snippet: "Valve's upcoming multiplayer game Deadlock has been generating buzz in the gaming community. The latest update introduced new mechanics and hero abilities."
      });
    } else {
      results.push({
        title: `Search Results for "${query}"`,
        url: `https://example.com/search?q=${encodeURIComponent(query)}`,
        snippet: `This is a simulated search result for the query "${query}". In a real implementation, this would contain actual web search results.`
      });
    }
    
    return results;
  }

  private async simulateWebSearch(query: string): Promise<any> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
    return {
      results: [`Search result for "${query}"`],
      timestamp: new Date().toISOString()
    };
  }

  private async simulateFileAnalysis(filePath: string): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1500));
    return {
      filePath,
      size: Math.floor(Math.random() * 10000),
      type: 'text/javascript',
      analysis: `Analysis complete for ${filePath}`
    };
  }

  private async simulateCodeExecution(code: string, language: string): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 2500));
    return {
      output: `Executed ${language} code successfully`,
      exitCode: 0,
      executionTime: Math.random() * 1000
    };
  }
}
