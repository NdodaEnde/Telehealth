import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDemoConsultation } from "@/hooks/useDemoConsultation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { VideoStream } from "./VideoStream";
import { VideoControls } from "./VideoControls";
import { 
  ArrowLeft, 
  Maximize2, 
  Minimize2, 
  Clock, 
  Video, 
  Play, 
  AlertTriangle,
  Loader2
} from "lucide-react";
import { toast } from "sonner";

export const DemoConsultation = () => {
  const navigate = useNavigate();
  const [callDuration, setCallDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isInWaitingRoom, setIsInWaitingRoom] = useState(true);

  const {
    localStream,
    remoteStream,
    isConnected,
    isConnecting,
    isMuted,
    isVideoOff,
    error,
    startCall,
    endCall,
    toggleMute,
    toggleVideo,
  } = useDemoConsultation();

  // Call duration timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isConnected) {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isConnected]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleJoinDemo = async () => {
    await startCall();
    if (!error) {
      setIsInWaitingRoom(false);
      toast.success("Demo consultation started!");
    }
  };

  const handleEndCall = async () => {
    await endCall();
    toast.info("Demo ended");
    navigate(-1);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Waiting room / demo setup screen
  if (isInWaitingRoom && !isConnected) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Badge variant="outline" className="bg-warning/10 text-warning border-warning">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Demo Mode
              </Badge>
            </div>
            <CardTitle className="text-2xl">Video Consultation Demo</CardTitle>
            <CardDescription>
              Test the video consultation features without needing a second account.
              Your camera will be mirrored to simulate a remote participant.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Preview area */}
            <div className="aspect-video bg-muted rounded-lg overflow-hidden relative">
              {localStream ? (
                <VideoStream
                  stream={localStream}
                  muted={true}
                  isLocal={true}
                  userName="Your Preview"
                  className="w-full h-full"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
                  <Video className="w-12 h-12 mb-2 opacity-50" />
                  <p>Camera preview will appear here</p>
                </div>
              )}
            </div>

            {/* Demo info */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold text-sm">What you can test:</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>✓ Camera and microphone access</li>
                <li>✓ Video/audio mute controls</li>
                <li>✓ Picture-in-picture layout</li>
                <li>✓ Fullscreen mode</li>
                <li>✓ Call duration timer</li>
              </ul>
            </div>

            {error && (
              <div className="bg-destructive/10 text-destructive rounded-lg p-4 text-sm">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-4">
              <Button 
                variant="outline" 
                onClick={() => navigate(-1)}
                className="flex-1"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button 
                onClick={handleJoinDemo} 
                disabled={isConnecting}
                className="flex-1 gradient-primary"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Start Demo
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Active demo call
  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4 flex items-center justify-between bg-gradient-to-b from-black/50 to-transparent">
        <Button variant="ghost" size="sm" onClick={handleEndCall} className="text-white">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Leave Demo
        </Button>
        
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="bg-warning/20 text-warning border-warning">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Demo
          </Badge>
          <Badge variant="secondary" className="bg-white/20 text-white">
            <Clock className="w-3 h-3 mr-1" />
            {formatDuration(callDuration)}
          </Badge>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={toggleFullscreen}
            className="text-white"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Video Grid */}
      <div className="flex-1 relative">
        {/* Remote Video (Full Screen) - Simulated */}
        <VideoStream
          stream={remoteStream}
          userName="Simulated Remote"
          className="w-full h-full"
        />

        {/* Local Video (Picture-in-Picture) */}
        <div className="absolute bottom-24 right-4 w-48 aspect-video rounded-lg overflow-hidden shadow-xl border-2 border-white/20">
          <VideoStream
            stream={localStream}
            muted={true}
            isLocal={true}
            isVideoOff={isVideoOff}
            userName="You"
            className="w-full h-full"
          />
        </div>
      </div>

      {/* Controls */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
        <VideoControls
          isMuted={isMuted}
          isVideoOff={isVideoOff}
          onToggleMute={toggleMute}
          onToggleVideo={toggleVideo}
          onEndCall={handleEndCall}
          isConnected={isConnected}
        />
      </div>
    </div>
  );
};
