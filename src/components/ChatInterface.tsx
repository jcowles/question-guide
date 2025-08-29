import { useState, useEffect, useRef } from 'react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { ApiKeyDialog } from './ApiKeyDialog';
import { OpenAIService, ChatMessage as ChatMessageType } from '@/services/openai';
import { Button } from '@/components/ui/button';
import { Settings, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export const ChatInterface = () => {
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
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
  }, [messages, isLoading]);

  const handleApiKeySaved = (key: string) => {
    OpenAIService.setApiKey(key);
    setOpenAIService(new OpenAIService(key));
    toast({
      title: "API Key Saved",
      description: "You can now start chatting with AI!",
    });
  };

  const handleSendMessage = async (content: string) => {
    if (!openAIService) {
      setShowApiDialog(true);
      return;
    }

    const userMessage: ChatMessageType = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const updatedMessages = [...messages, userMessage];
      const response = await openAIService.sendMessage(updatedMessages);
      
      const aiMessage: ChatMessageType = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to get AI response",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSettingsClick = () => {
    setShowApiDialog(true);
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-background to-background-secondary">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-background/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl message-user flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">AI Chat Assistant</h1>
            <p className="text-sm text-muted-foreground">Powered by GPT-4o</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={handleSettingsClick}>
          <Settings size={18} />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl message-user flex items-center justify-center">
              <MessageSquare className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold mb-2">Welcome to AI Chat!</h2>
              <p className="text-muted-foreground max-w-md">
                Start a conversation with GPT-4o. Ask questions, get help with coding, 
                creative writing, or just have a casual chat.
              </p>
            </div>
          </div>
        )}
        
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}
        
        {isLoading && (
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

      {/* API Key Dialog */}
      <ApiKeyDialog
        open={showApiDialog}
        onOpenChange={setShowApiDialog}
        onApiKeySaved={handleApiKeySaved}
      />
    </div>
  );
};