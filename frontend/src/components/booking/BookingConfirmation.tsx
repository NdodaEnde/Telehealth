import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar, Clock, User, Video, Phone, Building, CheckCircle2, Loader2 } from "lucide-react";
import { setHours, setMinutes } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { formatFullDateSAST, formatDateSAST, TIMEZONE_ABBR } from "@/lib/timezone";

interface BookingData {
  symptoms: string[];
  severity: "mild" | "moderate" | "severe";
  description: string;
  recommendedSpecialization: string | null;
  clinician: {
    id: string;
    first_name: string;
    last_name: string;
    specialization: string | null;
  };
  date: Date;
  time: string;
  consultationType: "video" | "phone" | "in_person";
}

interface BookingConfirmationProps {
  data: BookingData;
  onConfirm: () => void;
  onBack: () => void;
}

const CONSULTATION_ICONS = {
  video: Video,
  phone: Phone,
  in_person: Building,
};

const CONSULTATION_LABELS = {
  video: "Video Call",
  phone: "Phone Call",
  in_person: "In Person",
};

export const BookingConfirmation = ({
  data,
  onConfirm,
  onBack,
}: BookingConfirmationProps) => {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);

  const ConsultationIcon = CONSULTATION_ICONS[data.consultationType];

  const handleConfirmBooking = async () => {
    if (!user) {
      toast.error("You must be logged in to book an appointment");
      return;
    }

    setIsSubmitting(true);

    try {
      // First create the symptom assessment
      const { data: assessment, error: assessmentError } = await supabase
        .from("symptom_assessments")
        .insert({
          patient_id: user.id,
          symptoms: data.symptoms,
          severity: data.severity,
          description: data.description || null,
          recommended_specialization: data.recommendedSpecialization,
        })
        .select()
        .single();

      if (assessmentError) throw assessmentError;

      // Parse the time and create the scheduled_at timestamp
      const [hours, minutes] = data.time.split(":").map(Number);
      const scheduledAt = setMinutes(setHours(data.date, hours), minutes);

      // Create the appointment
      const { error: appointmentError } = await supabase
        .from("appointments")
        .insert({
          patient_id: user.id,
          clinician_id: data.clinician.id,
          symptom_assessment_id: assessment.id,
          scheduled_at: scheduledAt.toISOString(),
          consultation_type: data.consultationType,
          status: "pending",
        });

      if (appointmentError) throw appointmentError;

      setIsConfirmed(true);
      toast.success("Appointment booked successfully!");
    } catch (error: any) {
      console.error("Error booking appointment:", error);
      toast.error(error.message || "Failed to book appointment");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isConfirmed) {
    return (
      <Card className="text-center">
        <CardContent className="py-12">
          <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-success" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Booking Confirmed!</h2>
          <p className="text-muted-foreground mb-6">
            Your appointment with Dr. {data.clinician.first_name} {data.clinician.last_name} has been scheduled.
          </p>
          <div className="bg-muted/50 rounded-lg p-4 mb-6 inline-block">
            <p className="font-medium">{formatFullDateSAST(data.date)}</p>
            <p className="text-lg font-bold text-primary">{data.time} {TIMEZONE_ABBR}</p>
          </div>
          <p className="text-sm text-muted-foreground mb-6">
            You will receive a confirmation email with further instructions.
          </p>
          <Button onClick={onConfirm}>
            Return to Dashboard
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Review Your Booking</CardTitle>
          <CardDescription>
            Please review the details before confirming your appointment.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Clinician Info */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">
                Dr. {data.clinician.first_name} {data.clinician.last_name}
              </h3>
              <p className="text-sm text-muted-foreground">
                {data.clinician.specialization || "General Practice"}
              </p>
            </div>
          </div>

          <Separator />

          {/* Date & Time */}
          <div className="grid md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Date</p>
                <p className="font-medium">{format(data.date, "MMM d, yyyy")}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Time</p>
                <p className="font-medium">{data.time}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <ConsultationIcon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Type</p>
                <p className="font-medium">{CONSULTATION_LABELS[data.consultationType]}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Symptoms */}
          <div>
            <h4 className="font-medium mb-3">Reported Symptoms</h4>
            <div className="flex flex-wrap gap-2 mb-3">
              {data.symptoms.map((symptom, index) => (
                <Badge key={index} variant="secondary">
                  {symptom}
                </Badge>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Severity:</span>
              <Badge variant={
                data.severity === "severe" ? "destructive" :
                data.severity === "moderate" ? "default" : "secondary"
              }>
                {data.severity.charAt(0).toUpperCase() + data.severity.slice(1)}
              </Badge>
            </div>
            {data.description && (
              <p className="mt-3 text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                {data.description}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">
            By confirming this booking, you agree to our terms of service and consent to a telehealth consultation. 
            You can cancel or reschedule up to 2 hours before your appointment.
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={isSubmitting}>
          Back
        </Button>
        <Button onClick={handleConfirmBooking} disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Booking...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Confirm Booking
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
