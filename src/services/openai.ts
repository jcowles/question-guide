export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
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

  constructor(apiKey: string) {
    this.apiKey = apiKey;
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
    onError: (error: Error) => void
  ): Promise<void> {
    try {
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
          stream: true,
        }),
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
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                onChunk(content);
              }
            } catch (e) {
              // Ignore parsing errors for malformed chunks
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
}