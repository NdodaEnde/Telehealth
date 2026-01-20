import React, { useState, useRef } from 'react';
import { Send, Paperclip, Image, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSend: (content: string, messageType?: string, fileUrl?: string, fileName?: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({ 
  onSend, 
  disabled = false,
  placeholder = 'Type your message...'
}) => {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = async () => {
    if ((!message.trim() && !selectedFile) || isSending) return;

    setIsSending(true);
    try {
      // If there's a file, we'd upload it first (for MVP, just send as text)
      // In production, you'd upload to Supabase Storage and get the URL
      if (selectedFile) {
        // For now, just mention the file in the message
        const fileMessage = message.trim() 
          ? `${message.trim()}\n📎 ${selectedFile.name}` 
          : `📎 ${selectedFile.name}`;
        await onSend(fileMessage, 'text');
      } else {
        await onSend(message.trim(), 'text');
      }
      
      setMessage('');
      setSelectedFile(null);
      setPreviewUrl(null);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      
      // Create preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setPreviewUrl(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setPreviewUrl(null);
      }
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="border-t border-border p-4 bg-card">
      {/* File preview */}
      {selectedFile && (
        <div className="mb-3 p-2 bg-muted rounded-lg flex items-center gap-3">
          {previewUrl ? (
            <img src={previewUrl} alt="Preview" className="w-16 h-16 object-cover rounded" />
          ) : (
            <div className="w-16 h-16 bg-background rounded flex items-center justify-center">
              <Paperclip className="w-6 h-6 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{selectedFile.name}</p>
            <p className="text-xs text-muted-foreground">
              {(selectedFile.size / 1024).toFixed(1)} KB
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={removeFile}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,.doc,.docx"
          onChange={handleFileSelect}
          className="hidden"
        />
        
        <Button
          variant="ghost"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isSending}
          className="shrink-0"
        >
          <Image className="w-5 h-5" />
        </Button>

        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isSending}
          className="min-h-[44px] max-h-32 resize-none"
          rows={1}
        />

        <Button
          onClick={handleSend}
          disabled={disabled || isSending || (!message.trim() && !selectedFile)}
          size="icon"
          className="shrink-0"
        >
          {isSending ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground mt-2">
        Press Enter to send, Shift+Enter for new line
      </p>
    </div>
  );
};
