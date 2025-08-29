import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  SquarePen, 
  MessageSquare, 
  Settings, 
  Trash2,
  Gamepad2,
  Cloud
} from 'lucide-react';
import { ChatThread, ChatSection } from '@/services/openai';
import { ThreadManager } from '@/services/threadManager';

interface ChatSidebarProps {
  currentSection: ChatSection;
  currentThreadId: string | null;
  onSectionChange: (section: ChatSection) => void;
  onThreadSelect: (threadId: string) => void;
  onNewThread: () => void;
  onSettingsClick: () => void;
  onThreadsUpdate?: () => void;
}

export const ChatSidebar = ({ 
  currentSection, 
  currentThreadId, 
  onSectionChange, 
  onThreadSelect, 
  onNewThread,
  onSettingsClick,
  onThreadsUpdate 
}: ChatSidebarProps) => {
  const [threads, setThreads] = useState(() => ThreadManager.getAllThreads());

  // Update threads when external update occurs
  const updateThreads = () => {
    setThreads(ThreadManager.getAllThreads());
  };

  // Call onThreadsUpdate callback to notify parent
  if (onThreadsUpdate) {
    onThreadsUpdate = updateThreads;
  }

  const handleDeleteThread = (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    ThreadManager.deleteThread(currentSection, threadId);
    updateThreads();
    
    if (currentThreadId === threadId) {
      const remainingThreads = ThreadManager.getThreadsBySection(currentSection);
      if (remainingThreads.length > 0) {
        onThreadSelect(remainingThreads[0].id);
      } else {
        onNewThread();
      }
    }
  };

  const getSectionIcon = (section: ChatSection) => {
    switch (section) {
      case 'steam':
        return <Cloud size={16} />;
      case 'source2':
        return <Gamepad2 size={16} />;
    }
  };

  const getSectionBg = (section: ChatSection) => {
    switch (section) {
      case 'steam':
        return 'bg-blue-600 hover:bg-blue-700'; // Steam blue
      case 'source2':
        return 'bg-orange-600 hover:bg-orange-700'; // Valve red-orange
    }
  };

  const getSectionName = (section: ChatSection) => {
    switch (section) {
      case 'steam':
        return 'Steam';
      case 'source2':
        return 'Source 2';
    }
  };

  const currentThreads = threads[currentSection] || [];

  return (
    <div className="w-80 border-r bg-background-secondary/80 backdrop-blur-sm flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">AI Chat Assistant</h2>
          <Button variant="ghost" size="icon" onClick={onSettingsClick}>
            <Settings size={16} />
          </Button>
        </div>
        
        {/* Section Selector */}
        <div className="space-y-2">
          {(['steam', 'source2'] as ChatSection[]).map((section) => (
            <Button
              key={section}
              variant={currentSection === section ? "default" : "ghost"}
              className={`w-full justify-start gap-2 text-white ${
                currentSection === section 
                  ? getSectionBg(section)
                  : 'hover:bg-muted/50 text-foreground'
              }`}
              onClick={() => {
                onSectionChange(section);
                // Don't auto-create new thread - let user create one by sending first message
              }}
            >
              {getSectionIcon(section)}
              {getSectionName(section)}
              <SquarePen size={14} className="ml-auto" />
            </Button>
          ))}
        </div>
      </div>


      {/* Thread List */}
      <ScrollArea className="flex-1 p-2">
        <div className="space-y-1">
          {currentThreads.map((thread) => (
            <div
              key={thread.id}
              className={`group flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-colors ${
                currentThreadId === thread.id 
                  ? 'bg-accent text-accent-foreground' 
                  : 'hover:bg-accent/50'
              }`}
              onClick={() => onThreadSelect(thread.id)}
            >
              <MessageSquare size={14} className="flex-shrink-0 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{thread.name}</p>
                <p className="text-xs text-muted-foreground">
                  {thread.messages.length} messages • {thread.updatedAt.toLocaleDateString()}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6"
                onClick={(e) => handleDeleteThread(thread.id, e)}
              >
                <Trash2 size={12} />
              </Button>
            </div>
          ))}
          
          {currentThreads.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">No chats yet</p>
              <p className="text-xs">Start a new conversation</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};