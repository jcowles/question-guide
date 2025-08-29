import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Settings, Plug, Zap, Plus, Trash2, Edit2 } from 'lucide-react';
import { MCPClient, MCPClientConfig, MCPSession } from '@/services/mcpClient';
import { useToast } from '@/hooks/use-toast';

interface MCPService {
  id: string;
  name: string;
  baseUrl: string;
  apiKey?: string;
  enabled: boolean;
  client?: MCPClient;
  session?: MCPSession;
  isConnecting?: boolean;
}

interface MCPSettingsProps {
  mcpClient: MCPClient | null;
  onClientChange: (client: MCPClient | null) => void;
}

export function MCPSettings({ mcpClient, onClientChange }: MCPSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [services, setServices] = useState<MCPService[]>([]);
  const [editingService, setEditingService] = useState<MCPService | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    baseUrl: 'http://localhost:8000',
    apiKey: ''
  });
  const { toast } = useToast();

  // Load services from localStorage on mount
  useEffect(() => {
    const savedServices = localStorage.getItem('mcp-services');
    if (savedServices) {
      try {
        const parsed = JSON.parse(savedServices);
        setServices(parsed);
      } catch (error) {
        console.error('Failed to parse saved MCP services:', error);
      }
    }
  }, []);

  // Save services to localStorage whenever services change
  useEffect(() => {
    localStorage.setItem('mcp-services', JSON.stringify(
      services.map(s => ({
        id: s.id,
        name: s.name,
        baseUrl: s.baseUrl,
        apiKey: s.apiKey,
        enabled: s.enabled
      }))
    ));
  }, [services]);

  const handleAddService = () => {
    setEditingService(null);
    setFormData({ name: '', baseUrl: 'http://localhost:8000', apiKey: '' });
    setIsEditing(true);
  };

  const handleEditService = (service: MCPService) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      baseUrl: service.baseUrl,
      apiKey: service.apiKey || ''
    });
    setIsEditing(true);
  };

  const handleSaveService = () => {
    if (!formData.name.trim() || !formData.baseUrl.trim()) {
      toast({
        title: "Validation Error",
        description: "Name and URL are required",
        variant: "destructive"
      });
      return;
    }

    if (editingService) {
      // Update existing service
      setServices(prev => prev.map(s => 
        s.id === editingService.id 
          ? { ...s, name: formData.name, baseUrl: formData.baseUrl, apiKey: formData.apiKey }
          : s
      ));
      toast({
        title: "Service Updated",
        description: `Updated ${formData.name}`
      });
    } else {
      // Add new service
      const newService: MCPService = {
        id: Date.now().toString(),
        name: formData.name,
        baseUrl: formData.baseUrl,
        apiKey: formData.apiKey || undefined,
        enabled: false
      };
      setServices(prev => [...prev, newService]);
      toast({
        title: "Service Added",
        description: `Added ${formData.name}`
      });
    }
    
    setIsEditing(false);
    setEditingService(null);
  };

  const handleDeleteService = (serviceId: string) => {
    const service = services.find(s => s.id === serviceId);
    if (service?.client) {
      service.client.disconnect();
    }
    setServices(prev => prev.filter(s => s.id !== serviceId));
    toast({
      title: "Service Removed",
      description: "MCP service removed"
    });
  };

  const handleToggleService = async (serviceId: string) => {
    const service = services.find(s => s.id === serviceId);
    if (!service) return;

    if (service.enabled && service.client) {
      // Disconnect
      service.client.disconnect();
      setServices(prev => prev.map(s => 
        s.id === serviceId 
          ? { ...s, enabled: false, client: undefined, session: undefined }
          : s
      ));
      toast({
        title: "Service Disconnected",
        description: `Disconnected from ${service.name}`
      });
    } else {
      // Connect
      setServices(prev => prev.map(s => 
        s.id === serviceId ? { ...s, isConnecting: true } : s
      ));

      try {
        const config: MCPClientConfig = {
          baseUrl: service.baseUrl,
          apiKey: service.apiKey || undefined
        };

        const client = new MCPClient(config);
        const sessionInfo = await client.initialize();
        
        setServices(prev => prev.map(s => 
          s.id === serviceId 
            ? { ...s, enabled: true, client, session: sessionInfo, isConnecting: false }
            : s
        ));

        // Update main MCP client if this is the first connected service
        if (!mcpClient) {
          onClientChange(client);
        }
        
        toast({
          title: "Service Connected",
          description: `Connected to ${sessionInfo.serverInfo.name} v${sessionInfo.serverInfo.version}`
        });
      } catch (error) {
        setServices(prev => prev.map(s => 
          s.id === serviceId ? { ...s, isConnecting: false } : s
        ));
        toast({
          title: "Connection Failed",
          description: error instanceof Error ? error.message : "Unknown error",
          variant: "destructive"
        });
      }
    }
  };

  const connectedServices = services.filter(s => s.enabled && s.client);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Settings className="h-4 w-4" />
          MCP
          {connectedServices.length > 0 && (
            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
              {connectedServices.length}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>MCP Services</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Add Service Button */}
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Manage your Model Context Protocol services
            </p>
            <Button onClick={handleAddService} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Add Service
            </Button>
          </div>

          {/* Service Form */}
          {isEditing && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {editingService ? 'Edit Service' : 'Add New Service'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="serviceName">Service Name</Label>
                  <Input
                    id="serviceName"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="My MCP Server"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="serviceUrl">Server URL</Label>
                  <Input
                    id="serviceUrl"
                    value={formData.baseUrl}
                    onChange={(e) => setFormData(prev => ({ ...prev, baseUrl: e.target.value }))}
                    placeholder="http://localhost:8000"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="serviceApiKey">API Key (optional)</Label>
                  <Input
                    id="serviceApiKey"
                    type="password"
                    value={formData.apiKey}
                    onChange={(e) => setFormData(prev => ({ ...prev, apiKey: e.target.value }))}
                    placeholder="Enter API key if required"
                  />
                </div>
                
                <div className="flex gap-2">
                  <Button onClick={handleSaveService} className="flex-1">
                    {editingService ? 'Update' : 'Add'}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setIsEditing(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Services List */}
          <div className="space-y-3">
            {services.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center text-muted-foreground">
                    <Plug className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No MCP services configured</p>
                    <p className="text-xs">Add a service to get started</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              services.map((service) => (
                <Card key={service.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium">{service.name}</h4>
                          {service.enabled ? (
                            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                              Connected
                            </Badge>
                          ) : service.isConnecting ? (
                            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                              Connecting...
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              Disconnected
                            </Badge>
                          )}
                        </div>
                        
                        <p className="text-sm text-muted-foreground mb-2">
                          {service.baseUrl}
                        </p>
                        
                        {service.session && (
                          <div className="space-y-1 text-xs text-muted-foreground">
                            <div>Server: {service.session.serverInfo.name} v{service.session.serverInfo.version}</div>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {service.session.capabilities.tools && (
                                <Badge variant="secondary" className="text-xs">Tools</Badge>
                              )}
                              {service.session.capabilities.resources?.subscribe && (
                                <Badge variant="secondary" className="text-xs">Resources</Badge>
                              )}
                              {service.session.capabilities.logging && (
                                <Badge variant="secondary" className="text-xs">Logging</Badge>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditService(service)}
                          disabled={service.isConnecting}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteService(service.id)}
                          disabled={service.enabled || service.isConnecting}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant={service.enabled ? "destructive" : "default"}
                          size="sm"
                          onClick={() => handleToggleService(service.id)}
                          disabled={service.isConnecting}
                        >
                          {service.enabled ? "Disconnect" : "Connect"}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {connectedServices.length > 0 && (
            <>
              <Separator />
              <div className="text-sm text-muted-foreground">
                <strong>{connectedServices.length}</strong> service{connectedServices.length !== 1 ? 's' : ''} connected
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}