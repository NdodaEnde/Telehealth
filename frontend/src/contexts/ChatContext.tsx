import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { chatAPI } from '@/lib/api';

// Types
export interface Conversation {
  id: string;
  patient_id: string;
  patient_name?: string;
  receptionist_id?: string;
  receptionist_name?: string;
  status: 'new' | 'active' | 'booking_pending' | 'booked' | 'consultation_complete' | 'closed';
  patient_type?: 'medical_aid' | 'campus_africa' | 'university_student' | 'cash';
  booking_id?: string;
  last_message?: string;
  last_message_at?: string;
  unread_count: number;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name?: string;
  sender_role: string;
  content: string;
  message_type: 'text' | 'image' | 'file' | 'system' | 'booking_confirmation';
  file_url?: string;
  file_name?: string;
  read_at?: string;
  created_at: string;
}

interface ChatContextType {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  unreadCount: number;
  // Actions
  loadConversations: () => Promise<void>;
  loadUnassignedConversations: () => Promise<Conversation[]>;
  loadMyChats: () => Promise<Conversation[]>;
  selectConversation: (conversationId: string) => Promise<void>;
  createConversation: (initialMessage: string) => Promise<Conversation>;
  sendMessage: (content: string, messageType?: string, fileUrl?: string, fileName?: string) => Promise<void>;
  claimConversation: (conversationId: string) => Promise<void>;
  updateConversationStatus: (conversationId: string, status: string) => Promise<void>;
  markAsRead: () => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};

interface ChatProviderProps {
  children: ReactNode;
}

export const ChatProvider = ({ children }: ChatProviderProps) => {
  const { user, session } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate total unread count
  const unreadCount = conversations.reduce((acc, conv) => acc + (conv.unread_count || 0), 0);

  // Load conversations for the current user
  const loadConversations = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await chatAPI.getConversations();
      setConversations(data || []);
    } catch (err: any) {
      console.error('Error loading conversations:', err);
      setError(err.message || 'Failed to load conversations');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Load unassigned conversations (for receptionists)
  const loadUnassignedConversations = useCallback(async (): Promise<Conversation[]> => {
    try {
      const data = await chatAPI.getUnassignedConversations();
      return data || [];
    } catch (err: any) {
      console.error('Error loading unassigned conversations:', err);
      return [];
    }
  }, []);

  // Load my chats (for receptionists)
  const loadMyChats = useCallback(async (): Promise<Conversation[]> => {
    try {
      const data = await chatAPI.getMyChats();
      return data || [];
    } catch (err: any) {
      console.error('Error loading my chats:', err);
      return [];
    }
  }, []);

  // Select and load a conversation
  const selectConversation = useCallback(async (conversationId: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const [conversation, messagesData] = await Promise.all([
        chatAPI.getConversation(conversationId),
        chatAPI.getMessages(conversationId)
      ]);
      
      setCurrentConversation(conversation);
      setMessages(messagesData || []);
      
      // Mark as read
      await chatAPI.markAsRead(conversationId);
      
      // Update local state
      setConversations(prev => 
        prev.map(c => c.id === conversationId ? { ...c, unread_count: 0 } : c)
      );
    } catch (err: any) {
      console.error('Error loading conversation:', err);
      setError(err.message || 'Failed to load conversation');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Create a new conversation
  const createConversation = useCallback(async (initialMessage: string): Promise<Conversation> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const conversation = await chatAPI.createConversation(initialMessage);
      setConversations(prev => [conversation, ...prev]);
      setCurrentConversation(conversation);
      
      // Load messages
      const messagesData = await chatAPI.getMessages(conversation.id);
      setMessages(messagesData || []);
      
      return conversation;
    } catch (err: any) {
      console.error('Error creating conversation:', err);
      setError(err.message || 'Failed to create conversation');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Send a message
  const sendMessage = useCallback(async (
    content: string, 
    messageType: string = 'text',
    fileUrl?: string,
    fileName?: string
  ) => {
    if (!currentConversation) {
      throw new Error('No conversation selected');
    }
    
    try {
      const message = await chatAPI.sendMessage(
        currentConversation.id, 
        content, 
        messageType,
        fileUrl,
        fileName
      );
      
      setMessages(prev => [...prev, message]);
      
      // Update conversation in list
      setConversations(prev => 
        prev.map(c => c.id === currentConversation.id 
          ? { ...c, last_message: content, last_message_at: new Date().toISOString() }
          : c
        )
      );
    } catch (err: any) {
      console.error('Error sending message:', err);
      throw err;
    }
  }, [currentConversation]);

  // Claim a conversation (receptionist)
  const claimConversation = useCallback(async (conversationId: string) => {
    try {
      await chatAPI.claimConversation(conversationId);
      
      // Refresh the conversation
      await selectConversation(conversationId);
      await loadConversations();
    } catch (err: any) {
      console.error('Error claiming conversation:', err);
      throw err;
    }
  }, [selectConversation, loadConversations]);

  // Update conversation status
  const updateConversationStatus = useCallback(async (conversationId: string, status: string) => {
    try {
      await chatAPI.updateConversationStatus(conversationId, status);
      
      // Update local state
      setConversations(prev => 
        prev.map(c => c.id === conversationId ? { ...c, status: status as Conversation['status'] } : c)
      );
      
      if (currentConversation?.id === conversationId) {
        setCurrentConversation(prev => prev ? { ...prev, status: status as Conversation['status'] } : null);
      }
    } catch (err: any) {
      console.error('Error updating status:', err);
      throw err;
    }
  }, [currentConversation]);

  // Mark current conversation as read
  const markAsRead = useCallback(async () => {
    if (!currentConversation) return;
    
    try {
      await chatAPI.markAsRead(currentConversation.id);
      setConversations(prev => 
        prev.map(c => c.id === currentConversation.id ? { ...c, unread_count: 0 } : c)
      );
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  }, [currentConversation]);

  // Set up Supabase realtime subscriptions
  useEffect(() => {
    if (!user || !session) return;

    // Subscribe to new messages in conversations the user is part of
    const messagesChannel = supabase
      .channel('chat_messages_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages'
        },
        (payload) => {
          const newMessage = payload.new as any;
          
          // If this is for the current conversation, add it to messages
          if (currentConversation && newMessage.conversation_id === currentConversation.id) {
            // Only add if not sent by current user (to avoid duplicates)
            if (newMessage.sender_id !== user.id) {
              setMessages(prev => {
                // Check if message already exists
                if (prev.some(m => m.id === newMessage.id)) return prev;
                return [...prev, newMessage as Message];
              });
            }
          }
          
          // Update conversations list
          setConversations(prev => 
            prev.map(c => {
              if (c.id === newMessage.conversation_id) {
                return {
                  ...c,
                  last_message: newMessage.content?.substring(0, 100),
                  last_message_at: newMessage.created_at,
                  unread_count: c.id === currentConversation?.id ? 0 : c.unread_count + 1
                };
              }
              return c;
            })
          );
        }
      )
      .subscribe();

    // Subscribe to conversation updates
    const conversationsChannel = supabase
      .channel('chat_conversations_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_conversations'
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newConv = payload.new as Conversation;
            setConversations(prev => {
              if (prev.some(c => c.id === newConv.id)) return prev;
              return [newConv, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedConv = payload.new as Conversation;
            setConversations(prev => 
              prev.map(c => c.id === updatedConv.id ? { ...c, ...updatedConv } : c)
            );
            if (currentConversation?.id === updatedConv.id) {
              setCurrentConversation(prev => prev ? { ...prev, ...updatedConv } : null);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(conversationsChannel);
    };
  }, [user, session, currentConversation]);

  // Load conversations on mount
  useEffect(() => {
    if (user) {
      loadConversations();
    }
  }, [user, loadConversations]);

  return (
    <ChatContext.Provider
      value={{
        conversations,
        currentConversation,
        messages,
        isLoading,
        error,
        unreadCount,
        loadConversations,
        loadUnassignedConversations,
        loadMyChats,
        selectConversation,
        createConversation,
        sendMessage,
        claimConversation,
        updateConversationStatus,
        markAsRead,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};
