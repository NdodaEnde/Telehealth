import { useRef, useEffect } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { VideoOff, User } from "lucide-react";

interface VideoStreamProps {
  stream: MediaStream | null;
  muted?: boolean;
  isLocal?: boolean;
  isVideoOff?: boolean;
  userName?: string;
  className?: string;
}

export const VideoStream = ({
  stream,
  muted = false,
  isLocal = false,
  isVideoOff = false,
  userName = "Participant",
  className = "",
}: VideoStreamProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const initials = userName
    .split(" ")
    .map(n => n[0])
    .join("")
    .toUpperCase();

  if (!stream || isVideoOff) {
    return (
      <div className={`relative bg-muted flex items-center justify-center ${className}`}>
        <div className="text-center">
          <Avatar className="w-24 h-24 mx-auto mb-4">
            <AvatarFallback className="bg-primary/20 text-primary text-2xl">
              {initials || <User className="w-12 h-12" />}
            </AvatarFallback>
          </Avatar>
          {isVideoOff && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <VideoOff className="w-4 h-4" />
              <span className="text-sm">Camera off</span>
            </div>
          )}
        </div>
        {isLocal && (
          <div className="absolute bottom-4 left-4 bg-background/80 px-2 py-1 rounded text-xs">
            You
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`relative bg-black ${className}`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        className={`w-full h-full object-cover ${isLocal ? "transform -scale-x-100" : ""}`}
      />
      {isLocal && (
        <div className="absolute bottom-4 left-4 bg-background/80 px-2 py-1 rounded text-xs">
          You
        </div>
      )}
      {!isLocal && userName && (
        <div className="absolute bottom-4 left-4 bg-background/80 px-2 py-1 rounded text-xs">
          {userName}
        </div>
      )}
    </div>
  );
};
