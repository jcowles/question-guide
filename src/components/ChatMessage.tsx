import { ChatMessage as ChatMessageType, MCPToolStatus } from '@/services/openai';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Bot, User, ChevronDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useState } from 'react';

interface ChatMessageProps {
  message: ChatMessageType;
  isTyping?: boolean;
  streamingContent?: string;
  toolResults?: MCPToolStatus[];
}

export const ChatMessage = ({ message, isTyping = false, streamingContent, toolResults }: ChatMessageProps) => {
  const [isToolResultsOpen, setIsToolResultsOpen] = useState(false);
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const isTool = message.role === 'tool';
  
  // Don't render system messages or tool messages
  if (isSystem || isTool) return null;
  
  const hasToolResults = toolResults && toolResults.length > 0;

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
            <div className="text-sm leading-relaxed">
              {isUser ? (
                <p className="whitespace-pre-wrap">
                  {streamingContent || message.content}
                  {streamingContent && <span className="animate-pulse">|</span>}
                </p>
              ) : (
                <div className="prose prose-sm max-w-none prose-invert">
                  <ReactMarkdown 
                    components={{
                      p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                      code: ({ children }) => <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">{children}</code>,
                      pre: ({ children }) => <pre className="bg-muted p-3 rounded-lg overflow-x-auto my-2">{children}</pre>,
                      ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
                      li: ({ children }) => <li className="mb-1">{children}</li>,
                      h1: ({ children }) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-base font-bold mb-2">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-sm font-bold mb-1">{children}</h3>,
                      blockquote: ({ children }) => <blockquote className="border-l-4 border-muted pl-4 italic">{children}</blockquote>,
                    }}
                  >
                    {streamingContent || message.content}
                  </ReactMarkdown>
                </div>
              )}
              {streamingContent && !isUser && <span className="animate-pulse">|</span>}
            </div>
          )}
        </div>
        
        <div className={`text-xs text-muted-foreground mt-1 ${isUser ? 'text-right' : 'text-left'}`}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
        
        {/* MCP Tool Results - Only show for AI messages */}
        {!isUser && hasToolResults && (
          <div className="mt-2">
            <Collapsible open={isToolResultsOpen} onOpenChange={setIsToolResultsOpen}>
              <CollapsibleTrigger className="flex items-center text-xs text-muted-foreground hover:text-foreground transition-colors">
                <ChevronDown className={`h-3 w-3 mr-1 transition-transform ${isToolResultsOpen ? 'rotate-180' : ''}`} />
                {toolResults && toolResults.length === 1 
                  ? `${toolResults[0].toolName} result`
                  : toolResults && toolResults.length > 1
                  ? `${toolResults.length} tool results: ${toolResults.map(t => t.toolName).join(', ')}`
                  : `MCP Tool Results (${toolResults?.length})`
                }
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 p-3 bg-muted/30 rounded-lg border border-muted">
                  <div className="space-y-2">
                    {toolResults?.map((tool, index) => (
                      <div key={index} className="text-xs">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-foreground">{tool.toolName}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                            tool.status === 'success' 
                              ? 'bg-green-500/20 text-green-400' 
                              : tool.status === 'error'
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            {tool.status}
                          </span>
                        </div>
                        {tool.error ? (
                          <div className="text-red-400 font-mono text-[10px] bg-red-500/10 p-1 rounded">
                            Error: {tool.error}
                          </div>
                        ) : tool.result ? (
                          <pre className="text-muted-foreground font-mono text-[10px] bg-black/20 p-1 rounded overflow-x-auto">
                            {JSON.stringify(tool.result, null, 2)}
                          </pre>
                        ) : (
                          <div className="text-muted-foreground text-[10px]">No result available</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}
      </div>
    </div>
  );
};