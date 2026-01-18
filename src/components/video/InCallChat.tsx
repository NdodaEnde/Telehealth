import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, X, Minimize2, Maximize2 } from "lucide-react";
import { useConsultationChat } from "@/hooks/useConsultationChat";
import { ChatMessageList } from "./ChatMessageList";
import { ChatInput } from "./ChatInput";
import { cn } from "@/lib/utils";

interface InCallChatProps {
  sessionId: string;
  currentUserId: string;
  isPatient: boolean;
}

export const InCallChat = ({
  sessionId,
  currentUserId,
  isPatient,
}: InCallChatProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const { messages, loading, sending, sendMessage, sendFile } =
    useConsultationChat(sessionId);

  // Track unread messages when chat is closed
  const handleToggleOpen = () => {
    if (!isOpen) {
      setUnreadCount(0);
    }
    setIsOpen(!isOpen);
    setIsMinimized(false);
  };

  // Show unread indicator when new messages arrive and chat is closed
  const lastMessageId = messages[messages.length - 1]?.id;

  if (!isOpen) {
    return (
      <div className="absolute bottom-24 left-4 z-20">
        <Button
          onClick={handleToggleOpen}
          size="lg"
          className="h-14 w-14 rounded-full shadow-lg bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white border border-white/30"
        >
          <MessageSquare className="h-6 w-6" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              {unreadCount}
            </Badge>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "absolute z-20 bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col transition-all",
        isMinimized
          ? "bottom-24 left-4 w-64 h-12"
          : "bottom-24 left-4 w-80 h-96 md:w-96 md:h-[28rem]"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted border-b">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm">Chat</span>
          <Badge variant="secondary" className="text-xs">
            {messages.length}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setIsMinimized(!isMinimized)}
          >
            {isMinimized ? (
              <Maximize2 className="h-3.5 w-3.5" />
            ) : (
              <Minimize2 className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setIsOpen(false)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-hidden px-2">
            {loading ? (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                Loading messages...
              </div>
            ) : (
              <ChatMessageList
                messages={messages}
                currentUserId={currentUserId}
                isPatient={isPatient}
              />
            )}
          </div>

          {/* Input */}
          <ChatInput
            onSendMessage={sendMessage}
            onSendFile={sendFile}
            sending={sending}
          />
        </>
      )}
    </div>
  );
};
