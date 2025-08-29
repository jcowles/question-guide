import { ChatMessage as ChatMessageType } from '@/services/openai';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Bot, User } from 'lucide-react';

interface ChatMessageProps {
  message: ChatMessageType;
  isTyping?: boolean;
  streamingContent?: string;
}

export const ChatMessage = ({ message, isTyping = false, streamingContent }: ChatMessageProps) => {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  
  // Don't render system messages
  if (isSystem) return null;

  return (
    <div className={`flex gap-3 mb-4 animate-message-in ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <Avatar className="w-8 h-8 flex-shrink-0">
        <AvatarFallback className={isUser ? 'message-user text-white' : 'message-ai'}>
          {isUser ? <User size={16} /> : <Bot size={16} />}
        </AvatarFallback>
      </Avatar>
      
      <div className={`max-w-[80%] ${isUser ? 'text-right' : 'text-left'}`}>
        <div
          className={`inline-block px-4 py-2 rounded-2xl ${
            isUser
              ? 'message-user text-white'
              : 'message-ai text-foreground'
          } ${isUser ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}
        >
          {isTyping ? (
            <div className="flex gap-1 py-1">
              <div className="w-2 h-2 bg-current rounded-full animate-pulse-typing"></div>
              <div className="w-2 h-2 bg-current rounded-full animate-pulse-typing" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-2 h-2 bg-current rounded-full animate-pulse-typing" style={{ animationDelay: '0.4s' }}></div>
            </div>
          ) : (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {streamingContent || message.content}
              {streamingContent && <span className="animate-pulse">|</span>}
            </p>
          )}
        </div>
        
        <div className={`text-xs text-muted-foreground mt-1 ${isUser ? 'text-right' : 'text-left'}`}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
};