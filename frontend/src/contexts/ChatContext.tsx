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

  // Helper: Deduplicate conversations by id
  const deduplicateConversations = (convs: Conversation[]): Conversation[] => {
    const seen = new Map<string, Conversation>();
    convs.forEach(conv => {
      if (!seen.has(conv.id)) {
        seen.set(conv.id, conv);
      }
    });
    return Array.from(seen.values());
  };

  // Helper: Enrich message with sender name from conversation context
  const enrichMessageName = (message: any, conversation: Conversation | null): Message => {
    let senderName = message.sender_name;
    
    if (!senderName && conversation) {
      if (message.sender_role === 'system') {
        senderName = 'System';
      } else if (message.sender_id === conversation.patient_id) {
        senderName = conversation.patient_name || 'Patient';
      } else if (message.sender_id === conversation.receptionist_id) {
        senderName = conversation.receptionist_name || 'Receptionist';
      } else if (['receptionist', 'admin', 'nurse', 'doctor'].includes(message.sender_role)) {
        senderName = conversation.receptionist_name || 'Staff';
      } else {
        senderName = 'Unknown';
      }
    }
    
    return {
      ...message,
      sender_name: senderName || message.sender_role || 'Unknown'
    };
  };

  // Load conversations for the current user
  const loadConversations = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await chatAPI.getConversations();
      // Deduplicate conversations
      const uniqueConvs = deduplicateConversations(data || []);
      setConversations(uniqueConvs);
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

  // Select and load a conversation - FIX #2: Properly set conversation with names
  const selectConversation = useCallback(async (conversationId: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Fetch full conversation details from API (includes names)
      const conversation = await chatAPI.getConversation(conversationId);
      
      console.log('[ChatContext] Selected conversation:', conversation);
      
      // Set current conversation with all enriched fields
      setCurrentConversation(conversation);
      
      // Load messages
      const messagesData = await chatAPI.getMessages(conversationId);
      
      // Enrich messages with names
      const enrichedMessages = (messagesData || []).map((msg: any) => 
        enrichMessageName(msg, conversation)
      );
      
      setMessages(enrichedMessages);
      
      // Mark as read
      await chatAPI.markAsRead(conversationId);
      
      // FIX: Update the conversation in the list with enriched data
      setConversations(prev => 
        prev.map(c => c.id === conversationId ? { ...c, ...conversation, unread_count: 0 } : c)
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
      
      // Add to list (avoiding duplicates)
      setConversations(prev => {
        if (prev.some(c => c.id === conversation.id)) return prev;
        return [conversation, ...prev];
      });
      
      setCurrentConversation(conversation);
      
      // Load messages
      const messagesData = await chatAPI.getMessages(conversation.id);
      const enrichedMessages = (messagesData || []).map((msg: any) => 
        enrichMessageName(msg, conversation)
      );
      setMessages(enrichedMessages);
      
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
      
      // Add message to list (it should have sender_name from API)
      setMessages(prev => {
        if (prev.some(m => m.id === message.id)) return prev;
        return [...prev, message];
      });
      
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
      
      // Refresh the conversation to get updated data with receptionist name
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
      
      // Update local state while preserving names
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

    // Subscribe to new messages
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
          
          console.log('[ChatContext] Realtime message received:', newMessage);
          
          // If this is for the current conversation, add it to messages
          if (currentConversation && newMessage.conversation_id === currentConversation.id) {
            // Only add if not sent by current user (to avoid duplicates)
            if (newMessage.sender_id !== user.id) {
              setMessages(prev => {
                // Check if message already exists
                if (prev.some(m => m.id === newMessage.id)) return prev;
                
                // FIX #5: Enrich message with name if missing
                const enrichedMessage = enrichMessageName(newMessage, currentConversation);
                
                return [...prev, enrichedMessage];
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
                  unread_count: c.id === currentConversation?.id ? 0 : (c.unread_count || 0) + 1
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
          const updatedConv = payload.new as any;
          
          console.log('[ChatContext] Realtime conversation update:', payload.eventType, updatedConv);
          
          if (payload.eventType === 'INSERT') {
            setConversations(prev => {
              // FIX #6: Prevent duplicates
              if (prev.some(c => c.id === updatedConv.id)) return prev;
              return [updatedConv as Conversation, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            // FIX #3: Preserve existing names when updating
            setConversations(prev => 
              prev.map(c => {
                if (c.id === updatedConv.id) {
                  return {
                    ...c,
                    ...updatedConv,
                    // Preserve names if not in update
                    patient_name: updatedConv.patient_name || c.patient_name,
                    receptionist_name: updatedConv.receptionist_name || c.receptionist_name,
                  };
                }
                return c;
              })
            );
            
            // Also update currentConversation if it's the one being updated
            if (currentConversation?.id === updatedConv.id) {
              setCurrentConversation(prev => prev ? {
                ...prev,
                ...updatedConv,
                // Preserve names
                patient_name: updatedConv.patient_name || prev.patient_name,
                receptionist_name: updatedConv.receptionist_name || prev.receptionist_name,
              } : null);
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
