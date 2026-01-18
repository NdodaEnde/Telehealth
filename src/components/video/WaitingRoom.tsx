import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Video, Mic, MicOff, VideoOff, Phone, Loader2, Clock } from "lucide-react";
import { VideoStream } from "./VideoStream";

interface WaitingRoomProps {
  appointmentInfo: {
    clinicianName?: string;
    patientName?: string;
    scheduledAt: string;
    consultationType: string;
  };
  isPatient: boolean;
  onJoinCall: () => void;
  isConnecting: boolean;
  localStream: MediaStream | null;
  onStartPreview: () => Promise<void>;
  error: string | null;
}

export const WaitingRoom = ({
  appointmentInfo,
  isPatient,
  onJoinCall,
  isConnecting,
  localStream,
  onStartPreview,
  error,
}: WaitingRoomProps) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [waitTime, setWaitTime] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setWaitTime(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    onStartPreview();
  }, []);

  const toggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  const formatWaitTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const otherPartyName = isPatient ? appointmentInfo.clinicianName : appointmentInfo.patientName;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">
            {isPatient ? "Waiting Room" : "Ready to Join?"}
          </CardTitle>
          <CardDescription>
            {isPatient 
              ? `You'll be connected with ${otherPartyName || "your clinician"} shortly`
              : `${otherPartyName || "Your patient"} is waiting for you`
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Video Preview */}
          <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
            <VideoStream
              stream={localStream}
              muted={true}
              isLocal={true}
              isVideoOff={isVideoOff}
              userName="You"
              className="w-full h-full"
            />
          </div>

          {/* Preview Controls */}
          <div className="flex items-center justify-center gap-4">
            <Button
              variant={isMuted ? "destructive" : "outline"}
              size="lg"
              className="rounded-full"
              onClick={toggleMute}
              disabled={!localStream}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </Button>
            <Button
              variant={isVideoOff ? "destructive" : "outline"}
              size="lg"
              className="rounded-full"
              onClick={toggleVideo}
              disabled={!localStream}
            >
              {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
            </Button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="text-center p-4 bg-destructive/10 rounded-lg text-destructive text-sm">
              {error}
            </div>
          )}

          {/* Waiting Info */}
          {isPatient && (
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span className="text-sm">Waiting: {formatWaitTime(waitTime)}</span>
            </div>
          )}

          {/* Join Button */}
          <Button
            size="lg"
            className="w-full"
            onClick={onJoinCall}
            disabled={isConnecting || !localStream}
          >
            {isConnecting ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Phone className="w-5 h-5 mr-2" />
                Join Consultation
              </>
            )}
          </Button>

          {/* Tips */}
          <div className="text-center text-sm text-muted-foreground space-y-1">
            <p>• Make sure you're in a quiet, well-lit environment</p>
            <p>• Test your audio and video before joining</p>
            <p>• Have any relevant documents ready</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
