import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Key, ExternalLink } from 'lucide-react';

interface ApiKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApiKeySaved: (key: string) => void;
}

export const ApiKeyDialog = ({ open, onOpenChange, onApiKeySaved }: ApiKeyDialogProps) => {
  const [apiKey, setApiKey] = useState('');

  const handleSave = () => {
    if (apiKey.trim()) {
      onApiKeySaved(apiKey.trim());
      setApiKey('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key size={20} />
            OpenAI API Key Required
          </DialogTitle>
          <DialogDescription className="space-y-2">
            <p>To use this AI chat interface, you need to provide your OpenAI API key.</p>
            <p className="text-sm">Your API key will be stored locally in your browser and never sent to our servers.</p>
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="api-key">API Key</Label>
            <Input
              id="api-key"
              type="password"
              placeholder="sk-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
          </div>
          
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={!apiKey.trim()} className="flex-1">
              Save API Key
            </Button>
            <Button
              variant="outline"
              onClick={() => window.open('https://platform.openai.com/api-keys', '_blank')}
            >
              <ExternalLink size={16} />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};