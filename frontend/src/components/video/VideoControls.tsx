import { Button } from "@/components/ui/button";
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  PhoneOff,
  MonitorUp,
  MessageSquare,
  Settings
} from "lucide-react";

interface VideoControlsProps {
  isMuted: boolean;
  isVideoOff: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onEndCall: () => void;
  isConnected: boolean;
}

export const VideoControls = ({
  isMuted,
  isVideoOff,
  onToggleMute,
  onToggleVideo,
  onEndCall,
  isConnected,
}: VideoControlsProps) => {
  return (
    <div className="flex items-center justify-center gap-4 p-4 bg-background/80 backdrop-blur-sm rounded-full">
      <Button
        variant={isMuted ? "destructive" : "secondary"}
        size="lg"
        className="rounded-full w-14 h-14"
        onClick={onToggleMute}
        title={isMuted ? "Unmute" : "Mute"}
      >
        {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
      </Button>

      <Button
        variant={isVideoOff ? "destructive" : "secondary"}
        size="lg"
        className="rounded-full w-14 h-14"
        onClick={onToggleVideo}
        title={isVideoOff ? "Turn on camera" : "Turn off camera"}
      >
        {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
      </Button>

      <Button
        variant="destructive"
        size="lg"
        className="rounded-full w-14 h-14"
        onClick={onEndCall}
        title="End call"
      >
        <PhoneOff className="w-6 h-6" />
      </Button>
    </div>
  );
};
