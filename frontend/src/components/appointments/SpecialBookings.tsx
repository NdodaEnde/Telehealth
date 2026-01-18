import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { 
  AlertTriangle, Clock, Loader2, CheckCircle2, Phone, 
  Stethoscope, ArrowLeft, ArrowRight 
} from "lucide-react";
import { toast } from "sonner";

const BACKEND_URL = import.meta.env.REACT_APP_BACKEND_URL || '';

interface WalkInBookingProps {
  onBack: () => void;
  onComplete: () => void;
}

const COMMON_SYMPTOMS = [
  "Fever", "Cough", "Headache", "Sore throat", "Body aches",
  "Fatigue", "Nausea", "Diarrhea", "Rash", "Dizziness"
];

export const WalkInBooking = ({ onBack, onComplete }: WalkInBookingProps) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [severity, setSeverity] = useState("moderate");
  const [notes, setNotes] = useState("");

  const toggleSymptom = (symptom: string) => {
    setSelectedSymptoms(prev => 
      prev.includes(symptom) 
        ? prev.filter(s => s !== symptom)
        : [...prev, symptom]
    );
  };

  const handleSubmit = async () => {
    if (!chiefComplaint.trim()) {
      toast.error("Please describe your main concern");
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

      const response = await fetch(`${BACKEND_URL}/api/appointments/walk-in`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          chief_complaint: chiefComplaint,
          symptoms: selectedSymptoms,
          severity,
          consultation_type: "in_person",
          notes: notes || null
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to create walk-in booking");
      }

      const result = await response.json();
      toast.success(`Walk-in registered! Queue position: ${result.queue_position || 'Next available'}`);
      onComplete();
    } catch (error) {
      console.error("Walk-in error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to register walk-in");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Clock className="w-6 h-6 text-primary" />
          </div>
          <div>
            <CardTitle>Walk-In Booking</CardTitle>
            <CardDescription>No appointment? Join the queue now</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="p-4 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground">
            Walk-in patients are seen in order of arrival. Average wait time today: <strong>~30 minutes</strong>
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="complaint">What brings you in today? *</Label>
          <Textarea
            id="complaint"
            value={chiefComplaint}
            onChange={(e) => setChiefComplaint(e.target.value)}
            placeholder="Describe your main concern..."
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label>Any of these symptoms?</Label>
          <div className="flex flex-wrap gap-2">
            {COMMON_SYMPTOMS.map((symptom) => (
              <Badge
                key={symptom}
                variant={selectedSymptoms.includes(symptom) ? "default" : "outline"}
                className="cursor-pointer py-1.5 px-3"
                onClick={() => toggleSymptom(symptom)}
              >
                {symptom}
              </Badge>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>How severe are your symptoms?</Label>
          <RadioGroup value={severity} onValueChange={setSeverity} className="flex gap-4">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="mild" id="mild" />
              <Label htmlFor="mild" className="cursor-pointer">Mild</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="moderate" id="moderate" />
              <Label htmlFor="moderate" className="cursor-pointer">Moderate</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="severe" id="severe" />
              <Label htmlFor="severe" className="cursor-pointer">Severe</Label>
            </div>
          </RadioGroup>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Additional notes (optional)</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything else we should know..."
            rows={2}
          />
        </div>

        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !chiefComplaint.trim()}>
            {loading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Registering...</>
            ) : (
              <><CheckCircle2 className="w-4 h-4 mr-2" /> Join Queue</>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};


interface EmergencyBookingProps {
  onBack: () => void;
  onComplete: () => void;
}

const EMERGENCY_SYMPTOMS = [
  "Chest pain", "Difficulty breathing", "Severe bleeding",
  "Loss of consciousness", "Severe allergic reaction", "Stroke symptoms",
  "Severe abdominal pain", "High fever (>39°C)", "Seizure"
];

export const EmergencyBooking = ({ onBack, onComplete }: EmergencyBookingProps) => {
  const [loading, setLoading] = useState(false);
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [emergencyContactNotified, setEmergencyContactNotified] = useState(false);

  const toggleSymptom = (symptom: string) => {
    setSelectedSymptoms(prev => 
      prev.includes(symptom) 
        ? prev.filter(s => s !== symptom)
        : [...prev, symptom]
    );
  };

  const handleSubmit = async () => {
    if (!chiefComplaint.trim()) {
      toast.error("Please describe your emergency");
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

      const response = await fetch(`${BACKEND_URL}/api/appointments/emergency`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          chief_complaint: chiefComplaint,
          symptoms: selectedSymptoms,
          severity: "severe",
          emergency_contact_notified: emergencyContactNotified
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to create emergency booking");
      }

      toast.success("Emergency booking created! A clinician will contact you immediately.");
      onComplete();
    } catch (error) {
      console.error("Emergency error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create emergency booking");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-red-500">
      <CardHeader className="bg-red-50">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-red-100">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <CardTitle className="text-red-700">Emergency Booking</CardTitle>
            <CardDescription className="text-red-600">
              For urgent medical situations - Priority assistance
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-3">
            <Phone className="w-5 h-5 text-red-600 mt-0.5" />
            <div>
              <p className="font-medium text-red-700">Life-threatening emergency?</p>
              <p className="text-sm text-red-600">
                Call <strong>10177</strong> (ambulance) or <strong>112</strong> (emergency) immediately
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="emergency-complaint">What is your emergency? *</Label>
          <Textarea
            id="emergency-complaint"
            value={chiefComplaint}
            onChange={(e) => setChiefComplaint(e.target.value)}
            placeholder="Describe what's happening..."
            rows={3}
            className="border-red-200 focus:border-red-500"
          />
        </div>

        <div className="space-y-2">
          <Label>Select any matching symptoms:</Label>
          <div className="flex flex-wrap gap-2">
            {EMERGENCY_SYMPTOMS.map((symptom) => (
              <Badge
                key={symptom}
                variant={selectedSymptoms.includes(symptom) ? "destructive" : "outline"}
                className="cursor-pointer py-1.5 px-3"
                onClick={() => toggleSymptom(symptom)}
              >
                {symptom}
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex items-center space-x-2 p-3 bg-muted rounded-lg">
          <input
            type="checkbox"
            id="notify-contact"
            checked={emergencyContactNotified}
            onChange={(e) => setEmergencyContactNotified(e.target.checked)}
            className="rounded"
          />
          <Label htmlFor="notify-contact" className="cursor-pointer text-sm">
            I have notified my emergency contact
          </Label>
        </div>

        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleSubmit} 
            disabled={loading || !chiefComplaint.trim()}
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...</>
            ) : (
              <><AlertTriangle className="w-4 h-4 mr-2" /> Request Emergency Help</>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
