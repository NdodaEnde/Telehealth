import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { videoAPI } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Video, VideoOff, ArrowLeft, AlertCircle, Clock, User } from "lucide-react";
import { toast } from "sonner";
import DailyIframe, { DailyCall } from "@daily-co/daily-js";

interface AppointmentInfo {
  id: string;
  scheduled_at: string;
  patient_id: string;
  clinician_id: string;
  status: string;
  patient_name?: string;
  clinician_name?: string;
}

export const DailyVideoConsultation = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, profile, role } = useAuth();
  
  const appointmentId = searchParams.get("appointment");
  
  const [loading, setLoading] = useState(true);
  const [joiningCall, setJoiningCall] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appointment, setAppointment] = useState<AppointmentInfo | null>(null);
  const [roomUrl, setRoomUrl] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isInCall, setIsInCall] = useState(false);
  const [callEnded, setCallEnded] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const callFrameRef = useRef<DailyCall | null>(null);

  // Fetch appointment details
  useEffect(() => {
    const fetchAppointment = async () => {
      if (!appointmentId || !user) {
        setError("No appointment specified");
        setLoading(false);
        return;
      }

      try {
        // Fetch appointment
        const { data: aptData, error: aptError } = await supabase
          .from("appointments")
          .select("*")
          .eq("id", appointmentId)
          .single();

        if (aptError || !aptData) {
          setError("Appointment not found");
          setLoading(false);
          return;
        }

        // Verify user is part of this appointment
        const isPatient = aptData.patient_id === user.id;
        const isClinician = aptData.clinician_id === user.id;
        const isStaff = role && ["admin", "receptionist"].includes(role);

        if (!isPatient && !isClinician && !isStaff) {
          setError("You are not authorized to join this consultation");
          setLoading(false);
          return;
        }

        // Fetch names
        const [patientProfile, clinicianProfile] = await Promise.all([
          supabase.from("profiles").select("first_name, last_name").eq("id", aptData.patient_id).single(),
          supabase.from("profiles").select("first_name, last_name").eq("id", aptData.clinician_id).single(),
        ]);

        setAppointment({
          ...aptData,
          patient_name: patientProfile.data 
            ? `${patientProfile.data.first_name} ${patientProfile.data.last_name}`.trim() 
            : "Patient",
          clinician_name: clinicianProfile.data 
            ? `${clinicianProfile.data.first_name} ${clinicianProfile.data.last_name}`.trim() 
            : "Clinician",
        });

        // Create room and token
        const roomResponse = await videoAPI.createRoom(appointmentId);
        const userName = profile 
          ? `${profile.first_name} ${profile.last_name}`.trim() 
          : (role === "patient" ? "Patient" : "Clinician");
        
        const tokenResponse = await videoAPI.createToken(
          roomResponse.room_name, 
          userName,
          role !== "patient"
        );

        setRoomUrl(tokenResponse.room_url);
        setToken(tokenResponse.token);
        
        // Update appointment status
        if (aptData.status !== "in_progress") {
          await supabase
            .from("appointments")
            .update({ status: "in_progress" })
            .eq("id", appointmentId);
        }

      } catch (err: any) {
        console.error("Error setting up video call:", err);
        setError(err.message || "Failed to set up video consultation");
      } finally {
        setLoading(false);
      }
    };

    fetchAppointment();
  }, [appointmentId, user, profile, role]);

  // Cleanup Daily call frame on unmount
  useEffect(() => {
    return () => {
      if (callFrameRef.current) {
        callFrameRef.current.destroy();
        callFrameRef.current = null;
      }
    };
  }, []);

  // Join the Daily call using SDK
  const joinCall = useCallback(async () => {
    if (!roomUrl || !token) return;

    setJoiningCall(true);

    // Small delay to ensure container is rendered
    await new Promise(resolve => setTimeout(resolve, 100));

    if (!containerRef.current) {
      setError("Video container not ready");
      setJoiningCall(false);
      return;
    }

    try {
      // Check if there's already an existing call instance and destroy it
      const existingCall = DailyIframe.getCallInstance();
      if (existingCall) {
        await existingCall.destroy();
      }

      // Create Daily call frame with proper SDK method
      const callFrame = DailyIframe.createFrame(containerRef.current, {
        iframeStyle: {
          position: "absolute",
          top: "0",
          left: "0",
          width: "100%",
          height: "100%",
          border: "0",
        },
        showLeaveButton: true,
        showFullscreenButton: true,
      });

      callFrameRef.current = callFrame;

      // Set up event listeners
      callFrame.on("joined-meeting", () => {
        console.log("Joined Daily meeting");
        toast.success("Connected to consultation");
        setIsInCall(true);
      });

      callFrame.on("left-meeting", () => {
        console.log("Left Daily meeting");
        handleCallEnded();
      });

      callFrame.on("error", (event) => {
        console.error("Daily error:", event);
        toast.error("Video call error occurred");
        setError("Video call error: " + (event?.errorMsg || "Unknown error"));
        setIsInCall(false);
        setJoiningCall(false);
      });

      callFrame.on("participant-joined", (event) => {
        console.log("Participant joined:", event?.participant?.user_name);
        if (event?.participant?.user_name) {
          toast.info(`${event.participant.user_name} joined the call`);
        }
      });

      callFrame.on("participant-left", (event) => {
        console.log("Participant left:", event?.participant?.user_name);
        if (event?.participant?.user_name && !event?.participant?.local) {
          toast.info(`${event.participant.user_name} left the call`);
        }
      });

      // Join the call with token - Daily will show its prejoin UI
      await callFrame.join({
        url: roomUrl,
        token: token,
      });

      // Hide loading overlay once Daily's UI is loaded
      // Daily shows its own prejoin UI where user clicks "Join"
      setJoiningCall(false);

    } catch (err: any) {
      console.error("Failed to join Daily call:", err);
      setError("Failed to join video call: " + (err.message || "Unknown error"));
      toast.error("Failed to join video call");
      setJoiningCall(false);
    }
  }, [roomUrl, token]);

  // Handle call ended
  const handleCallEnded = async () => {
    // Destroy the call frame
    if (callFrameRef.current) {
      try {
        await callFrameRef.current.destroy();
      } catch (e) {
        console.error("Error destroying call frame:", e);
      }
      callFrameRef.current = null;
    }

    setIsInCall(false);
    setCallEnded(true);

    if (appointment) {
      // Update appointment status
      await supabase
        .from("appointments")
        .update({ status: "completed" })
        .eq("id", appointment.id);
    }
  };

  // Leave call
  const leaveCall = async () => {
    if (callFrameRef.current) {
      try {
        await callFrameRef.current.leave();
      } catch (e) {
        console.error("Error leaving call:", e);
      }
    }
    setJoiningCall(false);
    handleCallEnded();
  };

  // Navigate to appropriate dashboard
  const goToDashboard = () => {
    if (role === "patient") {
      navigate("/dashboard");
    } else if (role === "nurse" || role === "doctor") {
      navigate("/clinician");
    } else {
      navigate("/");
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Setting up your consultation...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-2" />
            <CardTitle>Unable to Join</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={goToDashboard} className="w-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Call ended state
  if (callEnded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <Video className="w-12 h-12 text-primary mx-auto mb-2" />
            <CardTitle>Consultation Ended</CardTitle>
            <CardDescription>
              Your video consultation has ended successfully.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {role !== "patient" && (
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => navigate(`/clinical-notes?appointment=${appointmentId}`)}
              >
                Complete Clinical Notes
              </Button>
            )}
            <Button onClick={goToDashboard} className="w-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // In-call state OR joining state - Daily SDK container
  if (isInCall || joiningCall) {
    return (
      <div className="fixed inset-0 bg-black">
        <div 
          ref={containerRef} 
          className="w-full h-full"
          style={{ position: "relative" }}
        />
        {joiningCall && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-40">
            <div className="text-center text-white">
              <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" />
              <p>Connecting to consultation...</p>
            </div>
          </div>
        )}
        <Button
          variant="destructive"
          size="sm"
          className="absolute bottom-4 right-4 z-50"
          onClick={leaveCall}
        >
          <VideoOff className="w-4 h-4 mr-2" />
          Leave Call
        </Button>
      </div>
    );
  }

  // Pre-join / Waiting room state
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-primary/5 flex items-center justify-center p-4">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center">
          <Video className="w-16 h-16 text-primary mx-auto mb-4" />
          <CardTitle className="text-2xl">Ready to Join?</CardTitle>
          <CardDescription>
            {role === "patient" 
              ? `Your consultation with ${appointment?.clinician_name}`
              : `Consultation with ${appointment?.patient_name}`
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Appointment Info */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Scheduled Time</p>
                <p className="font-medium">
                  {appointment?.scheduled_at 
                    ? new Date(appointment.scheduled_at).toLocaleString()
                    : "N/A"
                  }
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">
                  {role === "patient" ? "Clinician" : "Patient"}
                </p>
                <p className="font-medium">
                  {role === "patient" ? appointment?.clinician_name : appointment?.patient_name}
                </p>
              </div>
            </div>
          </div>

          {/* Tips */}
          <div className="text-sm text-muted-foreground space-y-2">
            <p>Before joining, please ensure:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>You're in a quiet, private location</li>
              <li>Your camera and microphone are working</li>
              <li>You have a stable internet connection</li>
            </ul>
          </div>

          {/* Status Badge */}
          <div className="flex justify-center">
            <Badge variant="outline" className="text-green-600 border-green-600">
              Room Ready
            </Badge>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3">
            <Button size="lg" onClick={joinCall} className="w-full">
              <Video className="w-5 h-5 mr-2" />
              Join Consultation
            </Button>
            <Button variant="outline" onClick={goToDashboard} className="w-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DailyVideoConsultation;
