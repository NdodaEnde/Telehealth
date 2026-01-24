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

  // Join the Daily call
  const joinCall = useCallback(async () => {
    if (!roomUrl || !token) return;

    setIsInCall(true);
    
    // The iframe will load Daily's prebuilt UI with our token
    const fullUrl = `${roomUrl}?t=${token}`;
    
    if (iframeRef.current) {
      iframeRef.current.src = fullUrl;
    }
  }, [roomUrl, token]);

  // Handle messages from Daily iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Only handle messages from Daily
      if (!event.origin.includes("daily.co")) return;
      
      const { action } = event.data || {};
      
      if (action === "left-meeting") {
        handleCallEnded();
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Handle call ended
  const handleCallEnded = async () => {
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
  const leaveCall = () => {
    if (iframeRef.current) {
      // Send postMessage to Daily to leave
      iframeRef.current.contentWindow?.postMessage({ action: "leave-meeting" }, "*");
    }
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

  // In-call state - full screen Daily iframe
  if (isInCall) {
    return (
      <div className="fixed inset-0 bg-black">
        <iframe
          ref={iframeRef}
          className="w-full h-full border-0"
          allow="camera; microphone; display-capture; autoplay; clipboard-write"
          title="Video Consultation"
        />
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
