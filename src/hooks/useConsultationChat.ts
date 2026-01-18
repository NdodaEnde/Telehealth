import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ChatMessage {
  id: string;
  session_id: string;
  sender_id: string;
  sender_role: "patient" | "clinician";
  message_type: "text" | "file" | "link";
  content: string;
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  created_at: string;
}

export const useConsultationChat = (sessionId: string) => {
  const { user, role } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Fetch existing messages
  const fetchMessages = useCallback(async () => {
    if (!sessionId) return;

    try {
      const { data, error } = await supabase
        .from("consultation_messages")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      setMessages(
        (data || []).map((msg) => ({
          ...msg,
          sender_role: msg.sender_role as "patient" | "clinician",
          message_type: msg.message_type as "text" | "file" | "link",
        }))
      );
    } catch (err: any) {
      console.error("Error fetching messages:", err);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  // Send a text message
  const sendMessage = useCallback(
    async (content: string) => {
      if (!user || !sessionId || !content.trim()) return false;

      setSending(true);
      try {
        // Detect if it's a link
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const isLink = urlRegex.test(content);

        const { error } = await supabase.from("consultation_messages").insert({
          session_id: sessionId,
          sender_id: user.id,
          sender_role: role === "patient" ? "patient" : "clinician",
          message_type: isLink ? "link" : "text",
          content: content.trim(),
        });

        if (error) throw error;
        return true;
      } catch (err: any) {
        console.error("Error sending message:", err);
        toast.error("Failed to send message");
        return false;
      } finally {
        setSending(false);
      }
    },
    [user, sessionId, role]
  );

  // Send a file
  const sendFile = useCallback(
    async (file: File) => {
      if (!user || !sessionId) return false;

      setSending(true);
      try {
        // Upload file to storage
        const fileExt = file.name.split(".").pop();
        const filePath = `${sessionId}/${Date.now()}-${file.name}`;

        const { error: uploadError } = await supabase.storage
          .from("consultation-files")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Get signed URL
        const { data: urlData } = await supabase.storage
          .from("consultation-files")
          .createSignedUrl(filePath, 86400 * 7); // 7 days

        // Save message with file reference
        const { error: msgError } = await supabase
          .from("consultation_messages")
          .insert({
            session_id: sessionId,
            sender_id: user.id,
            sender_role: role === "patient" ? "patient" : "clinician",
            message_type: "file",
            content: file.name,
            file_url: urlData?.signedUrl || filePath,
            file_name: file.name,
            file_size: file.size,
          });

        if (msgError) throw msgError;

        toast.success("File sent");
        return true;
      } catch (err: any) {
        console.error("Error sending file:", err);
        toast.error("Failed to send file");
        return false;
      } finally {
        setSending(false);
      }
    },
    [user, sessionId, role]
  );

  // Set up realtime subscription
  useEffect(() => {
    if (!sessionId) return;

    fetchMessages();

    // Subscribe to new messages
    channelRef.current = supabase
      .channel(`chat-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "consultation_messages",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          setMessages((prev) => {
            // Avoid duplicates
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [
              ...prev,
              {
                ...newMsg,
                sender_role: newMsg.sender_role as "patient" | "clinician",
                message_type: newMsg.message_type as "text" | "file" | "link",
              },
            ];
          });
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [sessionId, fetchMessages]);

  return {
    messages,
    loading,
    sending,
    sendMessage,
    sendFile,
    refetch: fetchMessages,
  };
};
