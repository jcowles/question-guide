import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { 
  SquarePen, 
  MessageSquare, 
  Settings, 
  Trash2,
  Gamepad2
} from 'lucide-react';
import { ChatThread, ChatSection } from '@/services/openai';
import { ThreadManager } from '@/services/threadManager';
import steamLogo from '@/assets/steam-logo.png';

interface ChatSidebarProps {
  currentSection: ChatSection;
  currentThreadId: string | null;
  onSectionChange: (section: ChatSection) => void;
  onThreadSelect: (threadId: string) => void;
  onNewThread: () => void;
  onSettingsClick: () => void;
}

export const ChatSidebar = ({ 
  currentSection, 
  currentThreadId, 
  onSectionChange, 
  onThreadSelect, 
  onNewThread,
  onSettingsClick 
}: ChatSidebarProps) => {
  const [threads, setThreads] = useState(() => ThreadManager.getAllThreads());

  const handleDeleteThread = (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    ThreadManager.deleteThread(currentSection, threadId);
    setThreads(ThreadManager.getAllThreads());
    
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
        return <img src={steamLogo} alt="Steam" className="w-4 h-4" />;
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
    <div className="w-80 border-r bg-background/50 backdrop-blur-sm flex flex-col h-full">
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
              onClick={() => onSectionChange(section)}
            >
              {getSectionIcon(section)}
              {getSectionName(section)}
              <Badge variant="secondary" className="ml-auto">
                {threads[section]?.length || 0}
              </Badge>
            </Button>
          ))}
        </div>
      </div>

      {/* New Chat Button */}
      <div className="p-4 border-b">
        <Button 
          onClick={onNewThread} 
          variant="ghost"
          className="w-full gap-2 text-muted-foreground hover:text-foreground hover:bg-muted/50"
        >
          <SquarePen size={16} />
          New Chat
        </Button>
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