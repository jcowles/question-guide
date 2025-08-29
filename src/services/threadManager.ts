import { ChatThread, ChatMessage, ChatSection } from './openai';

export class ThreadManager {
  private static STORAGE_KEY = 'chat-threads';

  static getAllThreads(): Record<ChatSection, ChatThread[]> {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (!stored) {
      return { steam: [], source2: [] };
    }
    
    try {
      const parsed = JSON.parse(stored);
      // Convert date strings back to Date objects
      Object.keys(parsed).forEach(section => {
        parsed[section] = parsed[section].map((thread: any) => ({
          ...thread,
          createdAt: new Date(thread.createdAt),
          updatedAt: new Date(thread.updatedAt),
          messages: thread.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }))
        }));
      });
      return parsed;
    } catch {
      return { steam: [], source2: [] };
    }
  }

  static getThreadsBySection(section: ChatSection): ChatThread[] {
    const allThreads = this.getAllThreads();
    return allThreads[section] || [];
  }

  static getThread(section: ChatSection, threadId: string): ChatThread | null {
    const threads = this.getThreadsBySection(section);
    return threads.find(t => t.id === threadId) || null;
  }

  static createThread(section: ChatSection, name?: string): ChatThread {
    console.log('🧵 CREATING NEW THREAD:', { section, name, stackTrace: new Error().stack?.split('\n')[2] });
    
    const thread: ChatThread = {
      id: Date.now().toString(),
      name: name || 'New Chat',
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const allThreads = this.getAllThreads();
    allThreads[section] = [thread, ...allThreads[section]];
    this.saveAllThreads(allThreads);
    
    return thread;
  }

  static updateThread(section: ChatSection, threadId: string, updates: Partial<ChatThread>): void {
    const allThreads = this.getAllThreads();
    const sectionThreads = allThreads[section];
    const threadIndex = sectionThreads.findIndex(t => t.id === threadId);
    
    if (threadIndex !== -1) {
      sectionThreads[threadIndex] = {
        ...sectionThreads[threadIndex],
        ...updates,
        updatedAt: new Date(),
      };
      this.saveAllThreads(allThreads);
    }
  }

  static deleteThread(section: ChatSection, threadId: string): void {
    const allThreads = this.getAllThreads();
    allThreads[section] = allThreads[section].filter(t => t.id !== threadId);
    this.saveAllThreads(allThreads);
  }

  static addMessageToThread(section: ChatSection, threadId: string, message: ChatMessage): void {
    const allThreads = this.getAllThreads();
    const sectionThreads = allThreads[section];
    const threadIndex = sectionThreads.findIndex(t => t.id === threadId);
    
    if (threadIndex !== -1) {
      sectionThreads[threadIndex].messages.push(message);
      sectionThreads[threadIndex].updatedAt = new Date();
      this.saveAllThreads(allThreads);
    }
  }

  private static saveAllThreads(threads: Record<ChatSection, ChatThread[]>): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(threads));
  }
}