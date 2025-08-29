import { useState, useEffect, useRef } from 'react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { ChatSidebar } from './ChatSidebar';
import { ApiKeyDialog } from './ApiKeyDialog';
import { OpenAIService, ChatMessage as ChatMessageType, ChatSection, SYSTEM_MESSAGES, ChatThread } from '@/services/openai';
import { ThreadManager } from '@/services/threadManager';
import { Button } from '@/components/ui/button';
import { MessageSquare, Gamepad2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import steamLogo from '@/assets/steam-logo.png';

export const ChatInterface = () => {
  const [currentSection, setCurrentSection] = useState<ChatSection>('steam');
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [currentThread, setCurrentThread] = useState<ChatThread | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [openAIService, setOpenAIService] = useState<OpenAIService | null>(null);
  const [showApiDialog, setShowApiDialog] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const apiKey = OpenAIService.getApiKey();
    if (apiKey) {
      setOpenAIService(new OpenAIService(apiKey));
    } else {
      setShowApiDialog(true);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentThread?.messages, isLoading, streamingContent]);

  useEffect(() => {
    // Load or create initial thread when section changes
    const threads = ThreadManager.getThreadsBySection(currentSection);
    if (threads.length > 0) {
      handleThreadSelect(threads[0].id);
    } else {
      handleNewThread();
    }
  }, [currentSection]);

  const handleApiKeySaved = (key: string) => {
    OpenAIService.setApiKey(key);
    setOpenAIService(new OpenAIService(key));
    toast({
      title: "API Key Saved",
      description: "You can now start chatting with AI!",
    });
  };

  const handleSectionChange = (section: ChatSection) => {
    setCurrentSection(section);
  };

  const handleThreadSelect = (threadId: string) => {
    const thread = ThreadManager.getThread(currentSection, threadId);
    if (thread) {
      setCurrentThreadId(threadId);
      setCurrentThread(thread);
    }
  };

  const handleNewThread = () => {
    const newThread = ThreadManager.createThread(currentSection);
    setCurrentThreadId(newThread.id);
    setCurrentThread(newThread);
  };

  const handleSendMessage = async (content: string) => {
    if (!openAIService || !currentThread) {
      setShowApiDialog(true);
      return;
    }

    const userMessage: ChatMessageType = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    };

    // Add system message if this is the first user message
    const messages = [...currentThread.messages];
    if (messages.filter(m => m.role !== 'system').length === 0) {
      const systemMessage: ChatMessageType = {
        id: `system-${Date.now()}`,
        role: 'system',
        content: SYSTEM_MESSAGES[currentSection],
        timestamp: new Date(),
      };
      messages.push(systemMessage);
      ThreadManager.addMessageToThread(currentSection, currentThread.id, systemMessage);
    }

    // Add user message
    messages.push(userMessage);
    ThreadManager.addMessageToThread(currentSection, currentThread.id, userMessage);
    
    // Update local state
    setCurrentThread(prev => prev ? { ...prev, messages: [...prev.messages, userMessage] } : null);

    // Generate thread name from first user message if needed
    if (currentThread.name.startsWith('Chat ')) {
      const threadName = content.slice(0, 30) + (content.length > 30 ? '...' : '');
      ThreadManager.updateThread(currentSection, currentThread.id, { name: threadName });
      setCurrentThread(prev => prev ? { ...prev, name: threadName } : null);
    }

    setIsLoading(true);
    setStreamingContent('');
    
    // Create placeholder AI message for streaming
    const aiMessageId = (Date.now() + 1).toString();
    setStreamingMessageId(aiMessageId);

    try {
      let fullResponse = '';
      
      await openAIService.sendMessageStream(
        messages,
        (chunk: string) => {
          fullResponse += chunk;
          setStreamingContent(fullResponse);
        },
        () => {
          // Stream completed
          const aiMessage: ChatMessageType = {
            id: aiMessageId,
            role: 'assistant',
            content: fullResponse,
            timestamp: new Date(),
          };

          ThreadManager.addMessageToThread(currentSection, currentThread.id, aiMessage);
          setCurrentThread(prev => prev ? { ...prev, messages: [...prev.messages, aiMessage] } : null);
          setIsLoading(false);
          setStreamingContent('');
          setStreamingMessageId(null);
        },
        (error: Error) => {
          console.error('Streaming error:', error);
          toast({
            title: "Error",
            description: error.message || "Failed to get AI response",
            variant: "destructive",
          });
          setIsLoading(false);
          setStreamingContent('');
          setStreamingMessageId(null);
        }
      );
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to get AI response",
        variant: "destructive",
      });
      setIsLoading(false);
      setStreamingContent('');
      setStreamingMessageId(null);
    }
  };

  const handleSettingsClick = () => {
    setShowApiDialog(true);
  };

  const getSectionTitle = (section: ChatSection) => {
    switch (section) {
      case 'steam':
        return 'Steam Assistant';
      case 'source2':
        return 'Source 2 Assistant';
    }
  };

  const getSectionDescription = (section: ChatSection) => {
    switch (section) {
      case 'steam':
        return 'Ask about Steam platform, games, features, and community';
      case 'source2':
        return 'Get help with Source 2 engine development and modding';
    }
  };

  const getSectionIcon = (section: ChatSection, size: 'small' | 'large') => {
    const iconSize = size === 'small' ? 'w-5 h-5' : 'w-8 h-8';
    switch (section) {
      case 'steam':
        return <img src={steamLogo} alt="Steam" className={iconSize} />;
      case 'source2':
        return <Gamepad2 className={iconSize} />;
    }
  };

  const visibleMessages = currentThread?.messages.filter(m => m.role !== 'system') || [];

  return (
    <div className="flex h-screen bg-background">{/* Removed gradient */}
      <ChatSidebar
        currentSection={currentSection}
        currentThreadId={currentThreadId}
        onSectionChange={handleSectionChange}
        onThreadSelect={handleThreadSelect}
        onNewThread={handleNewThread}
        onSettingsClick={handleSettingsClick}
      />

      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-background/80 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center">
              {getSectionIcon(currentSection, 'small')}
            </div>
            <div>
              <h1 className="text-xl font-semibold">{getSectionTitle(currentSection)}</h1>
              <p className="text-sm text-muted-foreground">{getSectionDescription(currentSection)}</p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {visibleMessages.length === 0 && !streamingContent && (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
              <div className="w-16 h-16 flex items-center justify-center">
                {getSectionIcon(currentSection, 'large')}
              </div>
              <div>
                <h2 className="text-xl font-semibold mb-2">Welcome to {getSectionTitle(currentSection)}!</h2>
                <p className="text-muted-foreground max-w-md">
                  {getSectionDescription(currentSection)}. Start a conversation to get expert help and information.
                </p>
              </div>
            </div>
          )}
          
          {visibleMessages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}
          
          {streamingMessageId && streamingContent && (
            <ChatMessage
              message={{
                id: streamingMessageId,
                role: 'assistant',
                content: '',
                timestamp: new Date(),
              }}
              streamingContent={streamingContent}
            />
          )}
          
          {isLoading && !streamingContent && (
            <ChatMessage
              message={{
                id: 'typing',
                role: 'assistant',
                content: '',
                timestamp: new Date(),
              }}
              isTyping
            />
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <ChatInput onSendMessage={handleSendMessage} disabled={isLoading} />
      </div>

      {/* API Key Dialog */}
      <ApiKeyDialog
        open={showApiDialog}
        onOpenChange={setShowApiDialog}
        onApiKeySaved={handleApiKeySaved}
      />
    </div>
  );
};