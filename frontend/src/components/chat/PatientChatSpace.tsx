import React, { useState, useEffect } from 'react';
import { MessageCircle, Plus, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useChat, Conversation } from '@/contexts/ChatContext';
import { useAuth } from '@/contexts/AuthContext';
import { ChatConversationList } from './ChatConversationList';
import { ChatMessageList } from './ChatMessageList';
import { ChatInput } from './ChatInput';

interface PatientChatSpaceProps {
  onStartBooking?: () => void;
}

export const PatientChatSpace: React.FC<PatientChatSpaceProps> = ({ onStartBooking }) => {
  const { user } = useAuth();
  const {
    conversations,
    currentConversation,
    messages,
    isLoading,
    loadConversations,
    selectConversation,
    createConversation,
    sendMessage,
  } = useChat();

  const [showNewChat, setShowNewChat] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const handleStartNewChat = async () => {
    if (!newMessage.trim() || isCreating) return;

    setIsCreating(true);
    try {
      await createConversation(newMessage.trim());
      setNewMessage('');
      setShowNewChat(false);
      setMobileView('chat');
    } catch (error) {
      console.error('Error creating conversation:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleSelectConversation = async (conversation: Conversation) => {
    await selectConversation(conversation.id);
    setMobileView('chat');
  };

  const handleBackToList = () => {
    setMobileView('list');
  };

  // Mobile view
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  if (showNewChat) {
    return (
      <Card className="h-full">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setShowNewChat(false)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <CardTitle>Start a New Conversation</CardTitle>
              <CardDescription>Tell us how we can help you today</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Hi, I'd like to book a consultation for..."
            className="min-h-[150px]"
          />
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowNewChat(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleStartNewChat} 
              disabled={!newMessage.trim() || isCreating}
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Start Chat
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="h-full flex flex-col md:flex-row gap-4">
      {/* Conversation List - Hidden on mobile when chat is selected */}
      <Card className={`md:w-80 shrink-0 ${mobileView === 'chat' && isMobile ? 'hidden' : ''}`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Messages</CardTitle>
            <Button size="sm" onClick={() => setShowNewChat(true)}>
              <Plus className="w-4 h-4 mr-1" />
              New
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-y-auto max-h-[500px]">
          {isLoading && conversations.length === 0 ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <ChatConversationList
              conversations={conversations}
              selectedId={currentConversation?.id}
              onSelect={handleSelectConversation}
              showPatientName={false}
            />
          )}
        </CardContent>
      </Card>

      {/* Chat Area */}
      <Card className={`flex-1 flex flex-col min-h-[500px] ${mobileView === 'list' && isMobile ? 'hidden' : ''}`}>
        {currentConversation ? (
          <>
            <CardHeader className="pb-2 border-b">
              <div className="flex items-center gap-2">
                {isMobile && (
                  <Button variant="ghost" size="icon" onClick={handleBackToList}>
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                )}
                <div className="flex-1">
                  <CardTitle className="text-lg">
                    {currentConversation.receptionist_name || 'Waiting for receptionist'}
                  </CardTitle>
                  <CardDescription>
                    Status: {currentConversation.status.replace('_', ' ')}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            
            <ChatMessageList messages={messages} currentUserId={user?.id} />
            
            <ChatInput 
              onSend={sendMessage} 
              disabled={currentConversation.status === 'closed'}
              placeholder={
                currentConversation.status === 'closed' 
                  ? 'This conversation is closed' 
                  : 'Type your message...'
              }
            />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <MessageCircle className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Welcome to Chat</h3>
            <p className="text-muted-foreground mb-4">
              Start a conversation to book a consultation or ask questions
            </p>
            <Button onClick={() => setShowNewChat(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Start New Conversation
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
};
