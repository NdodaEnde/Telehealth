-- Create clinical_notes table for consultation documentation
CREATE TABLE public.clinical_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  clinician_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  
  -- Clinical findings
  chief_complaint TEXT,
  history_of_present_illness TEXT,
  examination_findings TEXT,
  
  -- Diagnosis with ICD-10
  diagnosis TEXT[],
  icd10_codes JSONB DEFAULT '[]'::jsonb,
  
  -- Treatment plan
  treatment_plan TEXT,
  prescriptions JSONB DEFAULT '[]'::jsonb,
  follow_up_instructions TEXT,
  follow_up_date DATE,
  
  -- Referrals
  referral_required BOOLEAN DEFAULT false,
  referral_details TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'completed', 'signed')),
  signed_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.clinical_notes ENABLE ROW LEVEL SECURITY;

-- Clinicians can create notes for their appointments
CREATE POLICY "Clinicians can create notes for their appointments"
ON public.clinical_notes
FOR INSERT
WITH CHECK (auth.uid() = clinician_id);

-- Clinicians can view their own notes
CREATE POLICY "Clinicians can view their own notes"
ON public.clinical_notes
FOR SELECT
USING (auth.uid() = clinician_id);

-- Clinicians can update their own draft notes
CREATE POLICY "Clinicians can update their own notes"
ON public.clinical_notes
FOR UPDATE
USING (auth.uid() = clinician_id);

-- Patients can view their completed notes
CREATE POLICY "Patients can view their completed notes"
ON public.clinical_notes
FOR SELECT
USING (auth.uid() = patient_id AND status = 'completed');

-- Admins can view all notes
CREATE POLICY "Admins can view all clinical notes"
ON public.clinical_notes
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_clinical_notes_updated_at
BEFORE UPDATE ON public.clinical_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_clinical_notes_appointment ON public.clinical_notes(appointment_id);
CREATE INDEX idx_clinical_notes_clinician ON public.clinical_notes(clinician_id);
CREATE INDEX idx_clinical_notes_status ON public.clinical_notes(status);