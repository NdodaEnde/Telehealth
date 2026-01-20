import React, { useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { User, Bot, Image, FileText, Calendar, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Message } from '@/contexts/ChatContext';

interface ChatMessageListProps {
  messages: Message[];
  currentUserId?: string;
}

export const ChatMessageList: React.FC<ChatMessageListProps> = ({ messages, currentUserId }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <p>No messages yet. Start the conversation!</p>
      </div>
    );
  }

  const renderMessageContent = (message: Message) => {
    switch (message.message_type) {
      case 'image':
        return (
          <div className="space-y-2">
            {message.file_url && (
              <img 
                src={message.file_url} 
                alt={message.file_name || 'Image'}
                className="max-w-xs rounded-lg cursor-pointer hover:opacity-90"
                onClick={() => window.open(message.file_url, '_blank')}
              />
            )}
            {message.content && <p>{message.content}</p>}
          </div>
        );
      
      case 'file':
        return (
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            <a 
              href={message.file_url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="underline hover:no-underline"
            >
              {message.file_name || 'Download file'}
            </a>
          </div>
        );
      
      case 'system':
        return (
          <div className="flex items-center gap-2 text-muted-foreground italic">
            <Bot className="w-4 h-4" />
            <span>{message.content}</span>
          </div>
        );
      
      case 'booking_confirmation':
        return (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-medium mb-1">
              <Calendar className="w-4 h-4" />
              <span>Booking Confirmed</span>
            </div>
            <p className="text-sm">{message.content}</p>
          </div>
        );
      
      default:
        return <p className="whitespace-pre-wrap">{message.content}</p>;
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((message, index) => {
        const isOwnMessage = message.sender_id === currentUserId;
        const isSystem = message.message_type === 'system' || message.sender_role === 'system';
        const showDate = index === 0 || 
          format(new Date(message.created_at), 'yyyy-MM-dd') !== 
          format(new Date(messages[index - 1].created_at), 'yyyy-MM-dd');

        return (
          <React.Fragment key={message.id}>
            {showDate && (
              <div className="flex justify-center">
                <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                  {format(new Date(message.created_at), 'MMMM d, yyyy')}
                </span>
              </div>
            )}
            
            {isSystem ? (
              <div className="flex justify-center">
                <div className="text-xs text-muted-foreground bg-muted/50 px-4 py-2 rounded-full">
                  {renderMessageContent(message)}
                </div>
              </div>
            ) : (
              <div className={cn(
                'flex gap-3',
                isOwnMessage ? 'flex-row-reverse' : 'flex-row'
              )}>
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                  isOwnMessage ? 'bg-primary text-primary-foreground' : 'bg-muted'
                )}>
                  <User className="w-4 h-4" />
                </div>
                
                <div className={cn(
                  'max-w-[70%] space-y-1',
                  isOwnMessage ? 'items-end' : 'items-start'
                )}>
                  <div className={cn(
                    'flex items-center gap-2 text-xs text-muted-foreground',
                    isOwnMessage ? 'flex-row-reverse' : 'flex-row'
                  )}>
                    <span className="font-medium">
                      {isOwnMessage ? 'You' : message.sender_name || message.sender_role}
                    </span>
                    <span>{format(new Date(message.created_at), 'HH:mm')}</span>
                  </div>
                  
                  <div className={cn(
                    'rounded-2xl px-4 py-2',
                    isOwnMessage 
                      ? 'bg-primary text-primary-foreground rounded-tr-sm' 
                      : 'bg-muted rounded-tl-sm'
                  )}>
                    {renderMessageContent(message)}
                  </div>
                </div>
              </div>
            )}
          </React.Fragment>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
};
