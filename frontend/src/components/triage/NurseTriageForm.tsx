import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Stethoscope, Heart, Thermometer, Activity, Scale, Ruler,
  AlertTriangle, CheckCircle2, Loader2, User, FileText, ArrowRight
} from "lucide-react";
import { toast } from "sonner";

const BACKEND_URL = import.meta.env.REACT_APP_BACKEND_URL || '';

interface VitalSigns {
  blood_pressure_systolic: number | null;
  blood_pressure_diastolic: number | null;
  heart_rate: number | null;
  respiratory_rate: number | null;
  temperature: number | null;
  oxygen_saturation: number | null;
  weight: number | null;
  height: number | null;
  pain_score: number | null;
}

interface TriageData {
  appointment_id: string;
  patient_id: string;
  vital_signs: VitalSigns;
  chief_complaint: string;
  symptom_duration: string;
  symptom_onset: string;
  ai_urgency?: string;
  ai_urgency_score?: number;
  ai_care_pathway?: string;
  ai_assessment_summary?: string;
  triage_priority: string;
  nurse_notes: string;
  allergies_confirmed: boolean;
  medications_confirmed: boolean;
  identity_verified: boolean;
  consent_obtained: boolean;
  medical_aid_verified: boolean;
  patient_education_provided: boolean;
  recommended_action: string;
  referral_reason?: string;
  doctor_notes?: string;
}

interface NurseTriageFormProps {
  appointmentId: string;
  patientId: string;
  patientName: string;
  aiAssessment?: {
    urgency: string;
    urgency_score: number;
    care_pathway: string;
    assessment_summary: string;
  };
  onComplete?: () => void;
}

const TRIAGE_PRIORITIES = [
  { value: "red", label: "Red - Immediate", color: "bg-red-500", description: "Life-threatening" },
  { value: "orange", label: "Orange - Very Urgent", color: "bg-orange-500", description: "Within 10 minutes" },
  { value: "yellow", label: "Yellow - Urgent", color: "bg-yellow-500", description: "Within 60 minutes" },
  { value: "green", label: "Green - Standard", color: "bg-green-500", description: "Within 2 hours" },
  { value: "blue", label: "Blue - Non-urgent", color: "bg-blue-500", description: "Within 4 hours" },
];

const RECOMMENDED_ACTIONS = [
  { value: "proceed_to_doctor", label: "Proceed to Doctor Consultation" },
  { value: "refer_to_emergency", label: "Refer to Emergency Services" },
  { value: "specialist_referral", label: "Specialist Referral Required" },
  { value: "follow_up", label: "Schedule Follow-up" },
  { value: "self_care", label: "Self-Care with Instructions" },
];

export const NurseTriageForm = ({
  appointmentId,
  patientId,
  patientName,
  aiAssessment,
  onComplete
}: NurseTriageFormProps) => {
  const [loading, setLoading] = useState(false);
  
  const [vitals, setVitals] = useState<VitalSigns>({
    blood_pressure_systolic: null,
    blood_pressure_diastolic: null,
    heart_rate: null,
    respiratory_rate: null,
    temperature: null,
    oxygen_saturation: null,
    weight: null,
    height: null,
    pain_score: null,
  });

  const [formData, setFormData] = useState({
    chief_complaint: "",
    symptom_duration: "",
    symptom_onset: "gradual",
    triage_priority: aiAssessment?.urgency === "emergency" ? "red" : "green",
    nurse_notes: "",
    allergies_confirmed: false,
    medications_confirmed: false,
    identity_verified: false,
    consent_obtained: false,
    medical_aid_verified: false,
    patient_education_provided: false,
    recommended_action: "proceed_to_doctor",
    referral_reason: "",
    doctor_notes: "",
  });

  const handleVitalChange = (field: keyof VitalSigns, value: string) => {
    const numValue = value ? parseFloat(value) : null;
    setVitals(prev => ({ ...prev, [field]: numValue }));
  };

  const handleSubmit = async () => {
    if (!formData.chief_complaint) {
      toast.error("Chief complaint is required");
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

      const payload: TriageData = {
        appointment_id: appointmentId,
        patient_id: patientId,
        vital_signs: vitals,
        chief_complaint: formData.chief_complaint,
        symptom_duration: formData.symptom_duration,
        symptom_onset: formData.symptom_onset,
        ai_urgency: aiAssessment?.urgency,
        ai_urgency_score: aiAssessment?.urgency_score,
        ai_care_pathway: aiAssessment?.care_pathway,
        ai_assessment_summary: aiAssessment?.assessment_summary,
        triage_priority: formData.triage_priority,
        nurse_notes: formData.nurse_notes,
        allergies_confirmed: formData.allergies_confirmed,
        medications_confirmed: formData.medications_confirmed,
        identity_verified: formData.identity_verified,
        consent_obtained: formData.consent_obtained,
        medical_aid_verified: formData.medical_aid_verified,
        patient_education_provided: formData.patient_education_provided,
        recommended_action: formData.recommended_action,
        referral_reason: formData.referral_reason || undefined,
        doctor_notes: formData.doctor_notes || undefined,
      };

      const response = await fetch(`${BACKEND_URL}/api/triage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Triage submission failed");
      }

      toast.success("Triage assessment saved successfully");
      onComplete?.();
    } catch (error: any) {
      toast.error(error.message || "Failed to save triage");
    } finally {
      setLoading(false);
    }
  };

  const selectedPriority = TRIAGE_PRIORITIES.find(p => p.value === formData.triage_priority);

  return (
    <div className="space-y-6">
      {/* Patient Info */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Patient: {patientName}
            </CardTitle>
            {aiAssessment && (
              <Badge variant="outline" className="text-sm">
                AI Assessment: {aiAssessment.urgency} ({aiAssessment.urgency_score}/10)
              </Badge>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Vital Signs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-primary" />
            Vital Signs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Blood Pressure (mmHg)</Label>
              <div className="flex gap-1 items-center">
                <Input
                  type="number"
                  placeholder="Sys"
                  value={vitals.blood_pressure_systolic || ''}
                  onChange={e => handleVitalChange('blood_pressure_systolic', e.target.value)}
                  className="w-16"
                />
                <span>/</span>
                <Input
                  type="number"
                  placeholder="Dia"
                  value={vitals.blood_pressure_diastolic || ''}
                  onChange={e => handleVitalChange('blood_pressure_diastolic', e.target.value)}
                  className="w-16"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Heart Rate (bpm)</Label>
              <Input
                type="number"
                placeholder="HR"
                value={vitals.heart_rate || ''}
                onChange={e => handleVitalChange('heart_rate', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Temperature (°C)</Label>
              <Input
                type="number"
                step="0.1"
                placeholder="Temp"
                value={vitals.temperature || ''}
                onChange={e => handleVitalChange('temperature', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">SpO2 (%)</Label>
              <Input
                type="number"
                placeholder="SpO2"
                value={vitals.oxygen_saturation || ''}
                onChange={e => handleVitalChange('oxygen_saturation', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Respiratory Rate</Label>
              <Input
                type="number"
                placeholder="RR"
                value={vitals.respiratory_rate || ''}
                onChange={e => handleVitalChange('respiratory_rate', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Weight (kg)</Label>
              <Input
                type="number"
                step="0.1"
                placeholder="kg"
                value={vitals.weight || ''}
                onChange={e => handleVitalChange('weight', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Height (cm)</Label>
              <Input
                type="number"
                placeholder="cm"
                value={vitals.height || ''}
                onChange={e => handleVitalChange('height', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Pain Score (0-10)</Label>
              <Input
                type="number"
                min="0"
                max="10"
                placeholder="0-10"
                value={vitals.pain_score || ''}
                onChange={e => handleVitalChange('pain_score', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Chief Complaint */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Chief Complaint
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>What is the main reason for this visit? *</Label>
            <Textarea
              value={formData.chief_complaint}
              onChange={e => setFormData({...formData, chief_complaint: e.target.value})}
              placeholder="Describe the patient's primary complaint..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Duration of Symptoms</Label>
              <Input
                value={formData.symptom_duration}
                onChange={e => setFormData({...formData, symptom_duration: e.target.value})}
                placeholder="e.g., 2 days"
              />
            </div>
            <div className="space-y-2">
              <Label>Onset</Label>
              <Select 
                value={formData.symptom_onset} 
                onValueChange={v => setFormData({...formData, symptom_onset: v})}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sudden">Sudden</SelectItem>
                  <SelectItem value="gradual">Gradual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Triage Priority */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-primary" />
            Triage Priority
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select 
            value={formData.triage_priority} 
            onValueChange={v => setFormData({...formData, triage_priority: v})}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TRIAGE_PRIORITIES.map(p => (
                <SelectItem key={p.value} value={p.value}>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${p.color}`} />
                    {p.label} - {p.description}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedPriority && (
            <div className={`p-3 rounded-lg ${selectedPriority.color} bg-opacity-10`}>
              <p className="text-sm font-medium">{selectedPriority.label}</p>
              <p className="text-xs text-muted-foreground">{selectedPriority.description}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pre-consultation Checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-primary" />
            Pre-Consultation Checklist
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { key: 'identity_verified', label: 'Patient identity verified' },
            { key: 'consent_obtained', label: 'Telehealth consent obtained' },
            { key: 'allergies_confirmed', label: 'Allergies reviewed and confirmed' },
            { key: 'medications_confirmed', label: 'Current medications reviewed' },
            { key: 'medical_aid_verified', label: 'Medical aid details verified' },
            { key: 'patient_education_provided', label: 'Patient education provided' },
          ].map(item => (
            <div key={item.key} className="flex items-center space-x-3">
              <Checkbox
                id={item.key}
                checked={(formData as any)[item.key]}
                onCheckedChange={(checked) => setFormData({...formData, [item.key]: !!checked})}
              />
              <Label htmlFor={item.key}>{item.label}</Label>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Nurse Notes & Recommendation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-primary" />
            Assessment & Recommendation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nurse Assessment Notes</Label>
            <Textarea
              value={formData.nurse_notes}
              onChange={e => setFormData({...formData, nurse_notes: e.target.value})}
              placeholder="Clinical observations and nursing assessment..."
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label>Recommended Action</Label>
            <Select 
              value={formData.recommended_action} 
              onValueChange={v => setFormData({...formData, recommended_action: v})}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {RECOMMENDED_ACTIONS.map(a => (
                  <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Notes for Doctor (optional)</Label>
            <Textarea
              value={formData.doctor_notes}
              onChange={e => setFormData({...formData, doctor_notes: e.target.value})}
              placeholder="Any specific notes for the consulting doctor..."
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex justify-end gap-3">
        <Button variant="outline">Cancel</Button>
        <Button onClick={handleSubmit} disabled={loading}>
          {loading ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
          ) : (
            <><CheckCircle2 className="w-4 h-4 mr-2" /> Complete Triage</>
          )}
        </Button>
      </div>
    </div>
  );
};
