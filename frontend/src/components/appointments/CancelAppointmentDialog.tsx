import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const BACKEND_URL = import.meta.env.REACT_APP_BACKEND_URL || '';

interface CancelAppointmentDialogProps {
  open: boolean;
  onClose: () => void;
  appointmentId: string;
  appointmentDate: string;
  clinicianName: string;
  onCancelled: () => void;
}

const CANCELLATION_REASONS = [
  { value: "feeling_better", label: "Feeling better / Symptoms resolved" },
  { value: "scheduling_conflict", label: "Schedule conflict / Can't make it" },
  { value: "found_alternative", label: "Found alternative care" },
  { value: "financial", label: "Financial reasons" },
  { value: "patient_request", label: "Personal reasons" },
  { value: "other", label: "Other" },
];

export const CancelAppointmentDialog = ({
  open,
  onClose,
  appointmentId,
  appointmentDate,
  clinicianName,
  onCancelled,
}: CancelAppointmentDialogProps) => {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCancel = async () => {
    if (!reason) {
      toast.error("Please select a cancellation reason");
      return;
    }

    setLoading(true);
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        toast.error("Please sign in to continue");
        return;
      }

      const response = await fetch(`${BACKEND_URL}/api/appointments/${appointmentId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          reason,
          reason_details: details || null,
          notify_clinician: true
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to cancel appointment");
      }

      const result = await response.json();
      
      if (result.late_cancellation) {
        toast.warning("Appointment cancelled. Note: This was a late cancellation (less than 2 hours notice).");
      } else {
        toast.success("Appointment cancelled successfully");
      }
      
      onCancelled();
      onClose();
    } catch (error) {
      console.error("Cancellation error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to cancel appointment");
    } finally {
      setLoading(false);
    }
  };

  // Check if it's a late cancellation
  const appointmentTime = new Date(appointmentDate);
  const now = new Date();
  const hoursUntil = (appointmentTime.getTime() - now.getTime()) / (1000 * 60 * 60);
  const isLateCancellation = hoursUntil < 2;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel Appointment</DialogTitle>
          <DialogDescription>
            Cancel your appointment with {clinicianName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isLateCancellation && (
            <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-warning">Late Cancellation Notice</p>
                <p className="text-muted-foreground">
                  This appointment is in less than 2 hours. Late cancellations may affect your future booking privileges.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <Label>Why are you cancelling?</Label>
            <RadioGroup value={reason} onValueChange={setReason} className="space-y-2">
              {CANCELLATION_REASONS.map((r) => (
                <div key={r.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={r.value} id={r.value} />
                  <Label htmlFor={r.value} className="font-normal cursor-pointer">
                    {r.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {reason === "other" && (
            <div className="space-y-2">
              <Label htmlFor="details">Please provide details</Label>
              <Textarea
                id="details"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Tell us more about why you're cancelling..."
                rows={3}
              />
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Keep Appointment
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleCancel} 
            disabled={loading || !reason}
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Cancelling...</>
            ) : (
              "Cancel Appointment"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CancelAppointmentDialog;
