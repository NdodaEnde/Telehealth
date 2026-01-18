import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useWebRTC } from "@/hooks/useWebRTC";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { VideoStream } from "./VideoStream";
import { VideoControls } from "./VideoControls";
import { WaitingRoom } from "./WaitingRoom";
import { InCallChat } from "./InCallChat";
import { ArrowLeft, Maximize2, Minimize2, Clock } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface AppointmentDetails {
  id: string;
  patient_id: string;
  clinician_id: string;
  scheduled_at: string;
  consultation_type: string;
  patient_name?: string;
  clinician_name?: string;
}

export const VideoConsultation = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, role } = useAuth();
  
  const appointmentId = searchParams.get("appointment");
  const [appointment, setAppointment] = useState<AppointmentDetails | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isInWaitingRoom, setIsInWaitingRoom] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);

  const isPatient = role === "patient";
  const isInitiator = !isPatient; // Clinician initiates the call

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
  } = useWebRTC({
    sessionId: sessionId || "",
    appointmentId: appointmentId || "",
    isInitiator,
    onConnected: () => {
      toast.success("Connected to consultation");
      setIsInWaitingRoom(false);
    },
    onDisconnected: () => {
      toast.info("Call ended");
    },
    onRemoteJoined: () => {
      toast.success(isPatient ? "Clinician joined" : "Patient joined");
    },
  });

  // Fetch appointment details
  useEffect(() => {
    const fetchAppointment = async () => {
      if (!appointmentId || !user) return;

      try {
        const { data: apt, error: aptError } = await supabase
          .from("appointments")
          .select("*")
          .eq("id", appointmentId)
          .single();

        if (aptError) throw aptError;

        // Fetch names
        const [patientProfile, clinicianProfile] = await Promise.all([
          supabase.from("profiles").select("first_name, last_name").eq("id", apt.patient_id).single(),
          supabase.from("profiles").select("first_name, last_name").eq("id", apt.clinician_id).single(),
        ]);

        setAppointment({
          ...apt,
          patient_name: patientProfile.data 
            ? `${patientProfile.data.first_name} ${patientProfile.data.last_name}`
            : "Patient",
          clinician_name: clinicianProfile.data
            ? `Dr. ${clinicianProfile.data.first_name} ${clinicianProfile.data.last_name}`
            : "Clinician",
        });

        // Create or get session
        const { data: existingSession } = await supabase
          .from("consultation_sessions")
          .select("id")
          .eq("appointment_id", appointmentId)
          .single();

        if (existingSession) {
          setSessionId(existingSession.id);
        } else {
          const { data: newSession, error: sessionError } = await supabase
            .from("consultation_sessions")
            .insert({
              appointment_id: appointmentId,
              patient_id: apt.patient_id,
              clinician_id: apt.clinician_id,
            })
            .select()
            .single();

          if (sessionError) throw sessionError;
          setSessionId(newSession.id);
        }

        // Update appointment status
        await supabase
          .from("appointments")
          .update({ status: "in_progress" })
          .eq("id", appointmentId);

      } catch (err: any) {
        console.error("Error fetching appointment:", err);
        toast.error("Failed to load appointment details");
      } finally {
        setLoading(false);
      }
    };

    fetchAppointment();
  }, [appointmentId, user]);

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

  const handleStartPreview = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      // Stream is managed by WebRTC hook
    } catch (err) {
      console.error("Failed to get media:", err);
    }
  };

  const handleJoinCall = async () => {
    if (!sessionId) {
      toast.error("Session not ready");
      return;
    }

    // Update session with join time
    const joinField = isPatient ? "patient_joined_at" : "clinician_joined_at";
    await supabase
      .from("consultation_sessions")
      .update({ [joinField]: new Date().toISOString(), status: "connected" })
      .eq("id", sessionId);

    await startCall();
    setIsInWaitingRoom(false);
  };

  const handleEndCall = async () => {
    await endCall();
    
    // Update session duration
    if (sessionId) {
      await supabase
        .from("consultation_sessions")
        .update({ 
          status: "ended",
          ended_at: new Date().toISOString(),
          duration_seconds: callDuration,
        })
        .eq("id", sessionId);
    }

    // Update appointment status
    if (appointmentId) {
      await supabase
        .from("appointments")
        .update({ status: "completed" })
        .eq("id", appointmentId);
    }

    navigate(isPatient ? "/patient" : "/clinician");
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading consultation...</div>
      </div>
    );
  }

  if (!appointment || !sessionId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <h2 className="text-xl font-semibold mb-2">Appointment Not Found</h2>
            <p className="text-muted-foreground mb-4">
              The requested consultation could not be found.
            </p>
            <Button onClick={() => navigate(isPatient ? "/patient" : "/clinician")}>
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isInWaitingRoom && !isConnected) {
    return (
      <WaitingRoom
        appointmentInfo={{
          clinicianName: appointment.clinician_name,
          patientName: appointment.patient_name,
          scheduledAt: appointment.scheduled_at,
          consultationType: appointment.consultation_type,
        }}
        isPatient={isPatient}
        onJoinCall={handleJoinCall}
        isConnecting={isConnecting}
        localStream={localStream}
        onStartPreview={handleStartPreview}
        error={error}
      />
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4 flex items-center justify-between bg-gradient-to-b from-black/50 to-transparent">
        <Button variant="ghost" size="sm" onClick={handleEndCall} className="text-white">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Leave
        </Button>
        
        <div className="flex items-center gap-4">
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
        {/* Remote Video (Full Screen) */}
        <VideoStream
          stream={remoteStream}
          userName={isPatient ? appointment.clinician_name : appointment.patient_name}
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

        {/* In-Call Chat */}
        <InCallChat
          sessionId={sessionId}
          currentUserId={user?.id || ""}
          isPatient={isPatient}
        />
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
