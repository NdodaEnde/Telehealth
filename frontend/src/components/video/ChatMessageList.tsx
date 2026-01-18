import { useRef, useEffect } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileIcon, Link as LinkIcon, Download } from "lucide-react";
import { format } from "date-fns";
import { ChatMessage } from "@/hooks/useConsultationChat";
import { cn } from "@/lib/utils";

interface ChatMessageListProps {
  messages: ChatMessage[];
  currentUserId: string;
  isPatient: boolean;
}

const formatFileSize = (bytes: number | null) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const renderLinkContent = (content: string) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = content.split(urlRegex);

  return parts.map((part, index) => {
    if (urlRegex.test(part)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline hover:text-primary/80 break-all"
        >
          {part}
        </a>
      );
    }
    return <span key={index}>{part}</span>;
  });
};

export const ChatMessageList = ({
  messages,
  currentUserId,
  isPatient,
}: ChatMessageListProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll to bottom on new messages
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        No messages yet. Start the conversation!
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
      <div className="space-y-3 py-4">
        {messages.map((message) => {
          const isOwnMessage = message.sender_id === currentUserId;
          const senderLabel =
            message.sender_role === "clinician" ? "Dr." : "Patient";

          return (
            <div
              key={message.id}
              className={cn(
                "flex gap-2",
                isOwnMessage ? "flex-row-reverse" : "flex-row"
              )}
            >
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarFallback
                  className={cn(
                    "text-xs",
                    message.sender_role === "clinician"
                      ? "bg-primary/10 text-primary"
                      : "bg-secondary text-secondary-foreground"
                  )}
                >
                  {message.sender_role === "clinician" ? "Dr" : "Pt"}
                </AvatarFallback>
              </Avatar>

              <div
                className={cn(
                  "max-w-[70%] space-y-1",
                  isOwnMessage ? "items-end" : "items-start"
                )}
              >
                <div
                  className={cn(
                    "rounded-2xl px-4 py-2",
                    isOwnMessage
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-muted rounded-tl-sm"
                  )}
                >
                  {message.message_type === "file" ? (
                    <a
                      href={message.file_url || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "flex items-center gap-2 hover:opacity-80",
                        isOwnMessage ? "text-primary-foreground" : ""
                      )}
                    >
                      <FileIcon className="h-4 w-4 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {message.file_name}
                        </p>
                        <p
                          className={cn(
                            "text-xs",
                            isOwnMessage
                              ? "text-primary-foreground/70"
                              : "text-muted-foreground"
                          )}
                        >
                          {formatFileSize(message.file_size)}
                        </p>
                      </div>
                      <Download className="h-4 w-4 flex-shrink-0" />
                    </a>
                  ) : message.message_type === "link" ? (
                    <div className="text-sm">
                      <div className="flex items-center gap-1 mb-1">
                        <LinkIcon className="h-3 w-3" />
                        <span className="text-xs opacity-70">Link</span>
                      </div>
                      {renderLinkContent(message.content)}
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">
                      {message.content}
                    </p>
                  )}
                </div>

                <p
                  className={cn(
                    "text-xs text-muted-foreground px-2",
                    isOwnMessage ? "text-right" : "text-left"
                  )}
                >
                  {format(new Date(message.created_at), "h:mm a")}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
};
