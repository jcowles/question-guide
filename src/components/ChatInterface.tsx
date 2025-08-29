
import { useState, useEffect, useRef } from 'react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { ChatSidebar } from './ChatSidebar';
import { ApiKeyDialog } from './ApiKeyDialog';
import { MCPStatusBar } from './MCPStatusBar';
import { OpenAIService, ChatMessage as ChatMessageType, ChatSection, SYSTEM_MESSAGES, ChatThread, ToolCall, MCPToolStatus } from '@/services/openai';
import { ThreadManager } from '@/services/threadManager';
import { Button } from '@/components/ui/button';
import { MessageSquare, Gamepad2, Cloud, Bug } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export const ChatInterface = () => {
  const [currentSection, setCurrentSection] = useState<ChatSection>('steam');
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [currentThread, setCurrentThread] = useState<ChatThread | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [openAIService, setOpenAIService] = useState<OpenAIService | null>(null);
  const [showApiDialog, setShowApiDialog] = useState(false);
  const [sidebarUpdateTrigger, setSidebarUpdateTrigger] = useState(0);
  const [mcpToolStatuses, setMcpToolStatuses] = useState<MCPToolStatus[]>([]);
  const [showMcpStatus, setShowMcpStatus] = useState(false);
  const [debugMode, setDebugMode] = useState(false); // Debug toggle
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

  const handleToolCall = (toolCall: ToolCall) => {
    const newStatus: MCPToolStatus = {
      toolName: toolCall.function.name,
      status: 'calling',
      timestamp: new Date(),
    };
    
    setMcpToolStatuses(prev => [...prev, newStatus]);
    setShowMcpStatus(true);
  };

  const handleToolResult = (toolName: string, result: any, error?: string) => {
    setMcpToolStatuses(prev => 
      prev.map(status => 
        status.toolName === toolName && status.status === 'calling'
          ? { 
              ...status, 
              status: error ? 'error' as const : 'success' as const,
              result,
              error,
              timestamp: new Date()
            }
          : status
      )
    );

    // Add debug message to chat if debug mode is enabled
    if (debugMode && currentThread) {
      const debugMessage: ChatMessageType = {
        id: `debug-tool-${Date.now()}`,
        role: 'system',
        content: `🔧 **MCP Tool Result: ${toolName}**\n\`\`\`json\n${JSON.stringify({ toolName, result, error, timestamp: new Date().toISOString() }, null, 2)}\n\`\`\``,
        timestamp: new Date(),
      };
      
      ThreadManager.addMessageToThread(currentSection, currentThread.id, debugMessage);
      setCurrentThread(prev => prev ? { ...prev, messages: [...prev.messages, debugMessage] } : null);
    }

    // Auto-hide status bar after 3 seconds once all tools completed
    setTimeout(() => {
      setMcpToolStatuses(prev => {
        const hasActiveCalls = prev.some(status => status.status === 'calling');
        if (!hasActiveCalls) {
          setShowMcpStatus(false);
          // Clear statuses after animation completes
          setTimeout(() => setMcpToolStatuses([]), 300);
        }
        return prev;
      });
    }, 3000);
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
    
    // Trigger sidebar update
    setSidebarUpdateTrigger(prev => prev + 1);

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

    // Enable debug mode in service if debug is on
    if (openAIService && debugMode) {
      openAIService.setDebugMode(true);
    }

    // Add debug message with OpenAI request if debug mode is enabled
    if (debugMode && currentThread) {
      const debugRequestMessage: ChatMessageType = {
        id: `debug-request-${Date.now()}`,
        role: 'system',
        content: `🚀 **OpenAI Request**\n\`\`\`json\n${JSON.stringify({
          model: 'gpt-4o',
          messages: messages.map(msg => ({
            role: msg.role,
            content: msg.content,
            ...(msg.toolCalls && { tool_calls: msg.toolCalls }),
            ...(msg.toolCallId && { tool_call_id: msg.toolCallId })
          })),
          tools: openAIService ? 'MCP tools enabled' : 'No tools',
          max_tokens: 1500,
          temperature: 0.7,
          stream: true,
          timestamp: new Date().toISOString()
        }, null, 2)}\n\`\`\``,
        timestamp: new Date(),
      };
      
      ThreadManager.addMessageToThread(currentSection, currentThread.id, debugRequestMessage);
      setCurrentThread(prev => prev ? { ...prev, messages: [...prev.messages, debugRequestMessage] } : null);
    }

    try {
      let fullResponse = '';
      let hasToolCalls = false;
      const executedTools: any[] = [];
      
      await openAIService.sendMessageStream(
        messages,
        (chunk: string) => {
          fullResponse += chunk;
          setStreamingContent(fullResponse);
        },
        () => {
          // Stream completed
          if (!hasToolCalls) {
            // Regular message without tool calls
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
          } else {
            // Tool calls completed, now get the final response
            handleToolExecutionComplete(messages, executedTools, aiMessageId);
          }
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
        },
        (toolCall: ToolCall) => {
          hasToolCalls = true;
          handleToolCall(toolCall);
          // Store the actual tool call for later use
          executedTools.push({
            toolCall: toolCall,
            result: null,
            error: null
          });
        },
        (toolName: string, result: any, error?: string) => {
          handleToolResult(toolName, result, error);
          
          // Debug logging for MCP tool results
          if (debugMode) {
            console.log('🔧 MCP Tool Result:', {
              toolName,
              result,
              error,
              rawResult: result
            });
          }
          
          // Update the corresponding tool call with results
          const toolIndex = executedTools.findIndex(t => 
            t.toolCall.function.name === toolName && t.result === null && t.error === null
          );
          if (toolIndex >= 0) {
            executedTools[toolIndex].result = result;
            executedTools[toolIndex].error = error;
          }
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

  const handleToolExecutionComplete = async (
    originalMessages: ChatMessageType[], 
    executedTools: any[], 
    aiMessageId: string
  ) => {
    if (!openAIService || !currentThread || executedTools.length === 0) {
      setIsLoading(false);
      setStreamingContent('');
      setStreamingMessageId(null);
      return;
    }

    // Create assistant message for tool calls first
    const assistantMessage: ChatMessageType = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: null,
      timestamp: new Date(),
      toolCalls: executedTools.map(tool => tool.toolCall)
    };

    // Add assistant message to thread
    ThreadManager.addMessageToThread(currentSection, currentThread.id, assistantMessage);

    // Create tool result messages with proper format for OpenAI API
    const toolMessages = executedTools.map((tool, index) => ({
      id: `tool-${Date.now()}-${index}`,
      role: 'tool' as const,
      content: tool.error 
        ? `Error executing ${tool.toolCall.function.name}: ${tool.error}` 
        : JSON.stringify(tool.result),
      timestamp: new Date(),
      toolCallId: tool.toolCall.id
    }));

    // Add tool messages to thread
    toolMessages.forEach(toolMsg => {
      ThreadManager.addMessageToThread(currentSection, currentThread.id, toolMsg);
    });

    const messagesWithTools = [...originalMessages, assistantMessage, ...toolMessages];

    // Get final response from the model with tool results
    try {
      let finalResponse = '';
      setStreamingContent('');

      // Debug logging for messages with tools
      if (debugMode) {
        console.log('📨 Final OpenAI request with tools:', {
          originalMessages: originalMessages.length,
          assistantMessage,
          toolMessages,
          messagesWithTools: messagesWithTools.length
        });
      }

      await openAIService.sendMessageStream(
        messagesWithTools,
        (chunk: string) => {
          finalResponse += chunk;
          setStreamingContent(finalResponse);
        },
        () => {
          // Final response completed
          const aiMessage: ChatMessageType = {
            id: aiMessageId,
            role: 'assistant',
            content: finalResponse,
            timestamp: new Date(),
          };

          ThreadManager.addMessageToThread(currentSection, currentThread.id, aiMessage);
          setCurrentThread(prev => prev ? { 
            ...prev, 
            messages: [...prev.messages, assistantMessage, ...toolMessages, aiMessage] 
          } : null);
          setIsLoading(false);
          setStreamingContent('');
          setStreamingMessageId(null);
          
          // Force hide MCP status bar after final response
          setShowMcpStatus(false);
          setTimeout(() => setMcpToolStatuses([]), 300);
        },
        (error: Error) => {
          console.error('Final response error:', error);
          toast({
            title: "Error",
            description: "Failed to get final response after tool execution",
            variant: "destructive",
          });
          setIsLoading(false);
          setStreamingContent('');
          setStreamingMessageId(null);
          setShowMcpStatus(false);
        }
      );
    } catch (error) {
      console.error('Error getting final response:', error);
      setIsLoading(false);
      setStreamingContent('');
      setStreamingMessageId(null);
      setShowMcpStatus(false);
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

  const getSectionIcon = (section: ChatSection, size: 'small' | 'medium' | 'large') => {
    const iconSize = size === 'small' ? 'w-5 h-5' : size === 'medium' ? 'w-7 h-7' : 'w-8 h-8';
    switch (section) {
      case 'steam':
        return <Cloud className={iconSize} />;
      case 'source2':
        return <Gamepad2 className={iconSize} />;
    }
  };

  const visibleMessages = currentThread?.messages.filter(m => {
    // Hide system messages except debug messages when debug mode is on
    if (m.role === 'system') {
      return debugMode && m.content.includes('🔧 **MCP Tool Result') || m.content.includes('🚀 **OpenAI Request');
    }
    // Hide tool messages
    return m.role !== 'tool';
  }) || [];

  return (
    <div className="flex h-screen bg-background">{/* Removed gradient */}
      <ChatSidebar
        currentSection={currentSection}
        currentThreadId={currentThreadId}
        onSectionChange={handleSectionChange}
        onThreadSelect={handleThreadSelect}
        onNewThread={handleNewThread}
        onSettingsClick={handleSettingsClick}
        key={sidebarUpdateTrigger}
      />

      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-background/80 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center">
              {getSectionIcon(currentSection, 'medium')}
            </div>
            <div>
              <h1 className="text-xl font-semibold">{getSectionTitle(currentSection)}</h1>
              <p className="text-sm text-muted-foreground">{getSectionDescription(currentSection)}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDebugMode(!debugMode)}
            className={debugMode ? "text-orange-600" : ""}
          >
            <Bug className="w-4 h-4 mr-2" />
            {debugMode ? "Debug ON" : "Debug"}
          </Button>
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
          
          {/* Debug Mode: Show raw MCP tool results */}
          {debugMode && mcpToolStatuses.length > 0 && (
            <div className="bg-muted/50 p-4 rounded-lg border-l-4 border-orange-500">
              <h4 className="font-semibold text-sm mb-2 flex items-center">
                <Bug className="w-4 h-4 mr-2" />
                Debug: MCP Tool Results
              </h4>
              {mcpToolStatuses.map((status, index) => (
                <div key={index} className="mb-2 text-xs">
                  <div className="font-mono">
                    <strong>{status.toolName}</strong> - {status.status}
                  </div>
                  {status.result && (
                    <pre className="mt-1 bg-background p-2 rounded text-xs overflow-auto">
                      {JSON.stringify(status.result, null, 2)}
                    </pre>
                  )}
                  {status.error && (
                    <div className="text-red-600 mt-1">{status.error}</div>
                  )}
                </div>
              ))}
            </div>
          )}
          
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

      {/* MCP Status Bar */}
      <MCPStatusBar 
        toolStatuses={mcpToolStatuses}
        isVisible={showMcpStatus}
      />

      {/* API Key Dialog */}
      <ApiKeyDialog
        open={showApiDialog}
        onOpenChange={setShowApiDialog}
        onApiKeySaved={handleApiKeySaved}
      />
    </div>
  );
};
