import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Settings, Plug, Zap } from 'lucide-react';
import { MCPClient, MCPClientConfig, MCPSession } from '@/services/mcpClient';
import { useToast } from '@/hooks/use-toast';

interface MCPSettingsProps {
  mcpClient: MCPClient | null;
  onClientChange: (client: MCPClient | null) => void;
}

export function MCPSettings({ mcpClient, onClientChange }: MCPSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [baseUrl, setBaseUrl] = useState('http://localhost:8000');
  const [apiKey, setApiKey] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [session, setSession] = useState<MCPSession | null>(null);
  const { toast } = useToast();

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const config: MCPClientConfig = {
        baseUrl,
        apiKey: apiKey || undefined
      };

      const client = new MCPClient(config);
      const sessionInfo = await client.initialize();
      
      setSession(sessionInfo);
      onClientChange(client);
      
      toast({
        title: "MCP Connected",
        description: `Connected to ${sessionInfo.serverInfo.name} v${sessionInfo.serverInfo.version}`
      });
    } catch (error) {
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive"
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    if (mcpClient) {
      mcpClient.disconnect();
      onClientChange(null);
      setSession(null);
      toast({
        title: "MCP Disconnected",
        description: "Disconnected from MCP server"
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Settings className="h-4 w-4" />
          MCP
          {mcpClient?.isConnected() && (
            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
              Connected
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>MCP Settings</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {!mcpClient?.isConnected() ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plug className="h-5 w-5" />
                  Connect to MCP Server
                </CardTitle>
                <CardDescription>
                  Configure connection to your Model Context Protocol server
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="baseUrl">Server URL</Label>
                  <Input
                    id="baseUrl"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="http://localhost:8000"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="apiKey">API Key (optional)</Label>
                  <Input
                    id="apiKey"
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter API key if required"
                  />
                </div>
                
                <Button 
                  onClick={handleConnect} 
                  disabled={isConnecting || !baseUrl}
                  className="w-full"
                >
                  {isConnecting ? "Connecting..." : "Connect"}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-green-600" />
                  Connected to MCP Server
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {session && (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Server:</span>
                      <span>{session.serverInfo.name} v{session.serverInfo.version}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Protocol:</span>
                      <span>{session.protocolVersion}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Session:</span>
                      <span className="font-mono text-xs">{session.sessionId.slice(0, 8)}...</span>
                    </div>
                  </div>
                )}
                
                <div className="flex flex-wrap gap-1">
                  {session?.capabilities.tools && (
                    <Badge variant="secondary">Tools</Badge>
                  )}
                  {session?.capabilities.resources?.subscribe && (
                    <Badge variant="secondary">Resources</Badge>
                  )}
                  {session?.capabilities.logging && (
                    <Badge variant="secondary">Logging</Badge>
                  )}
                </div>
                
                <Button 
                  onClick={handleDisconnect} 
                  variant="destructive"
                  className="w-full"
                >
                  Disconnect
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}