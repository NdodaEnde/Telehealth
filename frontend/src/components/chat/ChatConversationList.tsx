import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { MessageCircle, Clock, CheckCircle, Calendar, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Conversation } from '@/contexts/ChatContext';

interface ChatConversationListProps {
  conversations: Conversation[];
  selectedId?: string;
  onSelect: (conversation: Conversation) => void;
  showPatientName?: boolean;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  new: { label: 'New', color: 'bg-blue-500', icon: <MessageCircle className="w-3 h-3" /> },
  active: { label: 'Active', color: 'bg-green-500', icon: <Clock className="w-3 h-3" /> },
  booking_pending: { label: 'Pending', color: 'bg-yellow-500', icon: <Clock className="w-3 h-3" /> },
  booked: { label: 'Booked', color: 'bg-purple-500', icon: <Calendar className="w-3 h-3" /> },
  consultation_complete: { label: 'Complete', color: 'bg-gray-500', icon: <CheckCircle className="w-3 h-3" /> },
  closed: { label: 'Closed', color: 'bg-gray-400', icon: <CheckCircle className="w-3 h-3" /> },
};

export const ChatConversationList: React.FC<ChatConversationListProps> = ({
  conversations,
  selectedId,
  onSelect,
  showPatientName = false,
}) => {
  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
        <MessageCircle className="w-12 h-12 mb-4 opacity-50" />
        <p>No conversations yet</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {conversations.map((conversation) => {
        const status = statusConfig[conversation.status] || statusConfig.new;
        const isSelected = selectedId === conversation.id;
        
        return (
          <div
            key={conversation.id}
            onClick={() => onSelect(conversation)}
            className={cn(
              'p-4 cursor-pointer transition-colors hover:bg-accent',
              isSelected && 'bg-accent border-l-4 border-l-primary'
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {showPatientName ? (
                    <span className="font-medium text-sm truncate">
                      {conversation.patient_name || 'Unknown Patient'}
                    </span>
                  ) : (
                    <span className="font-medium text-sm truncate">
                      {conversation.receptionist_name || 'Waiting for receptionist...'}
                    </span>
                  )}
                  <Badge 
                    variant="secondary" 
                    className={cn('text-xs text-white', status.color)}
                  >
                    {status.icon}
                    <span className="ml-1">{status.label}</span>
                  </Badge>
                </div>
                
                <p className="text-sm text-muted-foreground truncate">
                  {conversation.last_message || 'No messages yet'}
                </p>
                
                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>
                    {conversation.last_message_at 
                      ? formatDistanceToNow(new Date(conversation.last_message_at), { addSuffix: true })
                      : formatDistanceToNow(new Date(conversation.created_at), { addSuffix: true })}
                  </span>
                </div>
              </div>
              
              {conversation.unread_count > 0 && (
                <Badge variant="destructive" className="rounded-full px-2">
                  {conversation.unread_count}
                </Badge>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
