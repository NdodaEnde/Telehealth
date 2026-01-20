import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
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
  
  // Use ref to access current conversation in realtime callbacks
  const currentConversationRef = useRef<Conversation | null>(null);
  
  // Keep ref in sync with state
  useEffect(() => {
    currentConversationRef.current = currentConversation;
  }, [currentConversation]);

  // Calculate total unread count
  const unreadCount = conversations.reduce((acc, conv) => acc + (conv.unread_count || 0), 0);

  // Load conversations for the current user
  const loadConversations = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await chatAPI.getConversations();
      // API returns enriched data with names
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
      // Fetch full conversation details from API (includes names)
      const conversation = await chatAPI.getConversation(conversationId);
      
      console.log('[ChatContext] Selected conversation with names:', {
        id: conversation.id,
        patient_name: conversation.patient_name,
        receptionist_name: conversation.receptionist_name
      });
      
      // Set current conversation with all enriched fields
      setCurrentConversation(conversation);
      
      // Load messages (API returns with sender_name)
      const messagesData = await chatAPI.getMessages(conversationId);
      setMessages(messagesData || []);
      
      // Mark as read
      await chatAPI.markAsRead(conversationId);
      
      // Update the conversation in the list with enriched data
      setConversations(prev => 
        prev.map(c => c.id === conversationId 
          ? { ...conversation, unread_count: 0 } 
          : c
        )
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
      
      // Add message to list (API returns with sender_name)
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
          
          console.log('[ChatContext] Realtime message received:', {
            id: newMessage.id,
            sender_name: newMessage.sender_name,
            sender_role: newMessage.sender_role,
            content: newMessage.content?.substring(0, 50)
          });
          
          const currentConv = currentConversationRef.current;
          
          // If this is for the current conversation, add it to messages
          if (currentConv && newMessage.conversation_id === currentConv.id) {
            // Only add if not sent by current user (to avoid duplicates)
            if (newMessage.sender_id !== user.id) {
              // Enrich the message with sender name if missing
              let enrichedMessage = { ...newMessage };
              
              if (!enrichedMessage.sender_name || enrichedMessage.sender_name === null) {
                // Determine name based on role and current conversation
                if (enrichedMessage.sender_role === 'patient') {
                  enrichedMessage.sender_name = currentConv.patient_name || 'Patient';
                } else if (enrichedMessage.sender_role === 'system') {
                  enrichedMessage.sender_name = 'System';
                } else {
                  // Receptionist, admin, nurse, doctor
                  enrichedMessage.sender_name = currentConv.receptionist_name || 'Staff';
                }
                
                console.log('[ChatContext] Enriched message sender_name to:', enrichedMessage.sender_name);
              }
              
              setMessages(prev => {
                if (prev.some(m => m.id === newMessage.id)) return prev;
                return [...prev, enrichedMessage as Message];
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
                  unread_count: c.id === currentConv?.id ? 0 : (c.unread_count || 0) + 1
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
          const currentConv = currentConversationRef.current;
          
          console.log('[ChatContext] Realtime conversation update:', payload.eventType, {
            id: updatedConv.id,
            status: updatedConv.status,
            has_patient_name: !!updatedConv.patient_name,
            has_receptionist_name: !!updatedConv.receptionist_name
          });
          
          if (payload.eventType === 'INSERT') {
            // NEW conversation - add with placeholder, then fetch enriched data
            setConversations(prev => {
              if (prev.some(c => c.id === updatedConv.id)) return prev;
              return [{
                ...updatedConv,
                patient_name: 'Loading...',
                receptionist_name: null,
              } as Conversation, ...prev];
            });
            
            // Fetch enriched data after a short delay
            setTimeout(async () => {
              try {
                const enriched = await chatAPI.getConversation(updatedConv.id);
                console.log('[ChatContext] Fetched enriched new conversation:', enriched.patient_name);
                setConversations(prev => 
                  prev.map(c => c.id === enriched.id ? enriched : c)
                );
              } catch (err) {
                console.error('[ChatContext] Failed to fetch enriched conversation:', err);
              }
            }, 500);
            
          } else if (payload.eventType === 'UPDATE') {
            // EXISTING conversation - PRESERVE existing names
            setConversations(prev => 
              prev.map(c => {
                if (c.id === updatedConv.id) {
                  // Merge: keep existing names, update other fields
                  return {
                    ...c,                    // Keep existing data (including names)
                    ...updatedConv,          // Override with new data
                    // But PRESERVE names since realtime doesn't include them
                    patient_name: c.patient_name,
                    receptionist_name: c.receptionist_name,
                  };
                }
                return c;
              })
            );
            
            // Also update currentConversation if it's the one being updated
            if (currentConv?.id === updatedConv.id) {
              setCurrentConversation(prev => prev ? {
                ...prev,
                ...updatedConv,
                // Preserve names
                patient_name: prev.patient_name,
                receptionist_name: prev.receptionist_name,
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
  }, [user, session]);

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
