import { useEffect, useState } from 'react';
import { MCPToolStatus } from '@/services/openai';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Loader2, CheckCircle, XCircle, Search, FileText, Code } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MCPStatusBarProps {
  toolStatuses: MCPToolStatus[];
  isVisible: boolean;
}

const getToolIcon = (toolName: string) => {
  switch (toolName) {
    case 'web_search':
      return <Search className="w-3 h-3" />;
    case 'file_analyzer':
      return <FileText className="w-3 h-3" />;
    case 'code_executor':
      return <Code className="w-3 h-3" />;
    default:
      return <Loader2 className="w-3 h-3" />;
  }
};

const getStatusIcon = (status: MCPToolStatus['status']) => {
  switch (status) {
    case 'calling':
      return <Loader2 className="w-3 h-3 animate-spin" />;
    case 'success':
      return <CheckCircle className="w-3 h-3 text-green-500" />;
    case 'error':
      return <XCircle className="w-3 h-3 text-destructive" />;
    default:
      return null;
  }
};

const getStatusVariant = (status: MCPToolStatus['status']) => {
  switch (status) {
    case 'calling':
      return 'secondary';
    case 'success':
      return 'default';
    case 'error':
      return 'destructive';
    default:
      return 'secondary';
  }
};

export const MCPStatusBar = ({ toolStatuses, isVisible }: MCPStatusBarProps) => {
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
    } else {
      // Delay hiding to allow exit animation
      const timer = setTimeout(() => setShouldRender(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  if (!shouldRender || toolStatuses.length === 0) {
    return null;
  }

  return (
    <Card
      className={cn(
        'fixed bottom-20 left-4 right-4 z-50 p-3 shadow-lg border-l-4 border-l-primary bg-card/95 backdrop-blur-sm',
        'transition-all duration-300 ease-in-out transform',
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
          <span className="text-xs font-medium text-muted-foreground">MCP Tools Active</span>
        </div>
      </div>
      
      <div className="flex flex-wrap gap-2">
        {toolStatuses.map((toolStatus, index) => (
          <Badge
            key={`${toolStatus.toolName}-${index}-${toolStatus.timestamp.getTime()}`}
            variant={getStatusVariant(toolStatus.status)}
            className="flex items-center gap-1.5 px-2 py-1"
          >
            {getToolIcon(toolStatus.toolName)}
            <span className="text-xs capitalize">
              {toolStatus.toolName.replace('_', ' ')}
            </span>
            {getStatusIcon(toolStatus.status)}
            {toolStatus.error && (
              <span className="text-xs text-destructive-foreground ml-1">
                ({toolStatus.error.substring(0, 20)}...)
              </span>
            )}
          </Badge>
        ))}
      </div>

      <div className="mt-2 text-xs text-muted-foreground">
        Last update: {new Date().toLocaleTimeString()}
      </div>
    </Card>
  );
};