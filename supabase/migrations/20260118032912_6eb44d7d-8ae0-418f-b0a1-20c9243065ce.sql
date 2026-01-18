
-- Create prescriptions table
CREATE TABLE public.prescriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id UUID REFERENCES public.appointments(id),
  clinical_note_id UUID REFERENCES public.clinical_notes(id),
  clinician_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  medication_name TEXT NOT NULL,
  dosage TEXT NOT NULL,
  frequency TEXT NOT NULL,
  duration TEXT NOT NULL,
  quantity INTEGER,
  refills INTEGER DEFAULT 0,
  instructions TEXT,
  pharmacy_notes TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  prescribed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Clinicians can create prescriptions"
ON public.prescriptions
FOR INSERT
WITH CHECK (auth.uid() = clinician_id);

CREATE POLICY "Clinicians can view their prescriptions"
ON public.prescriptions
FOR SELECT
USING (auth.uid() = clinician_id);

CREATE POLICY "Clinicians can update their prescriptions"
ON public.prescriptions
FOR UPDATE
USING (auth.uid() = clinician_id);

CREATE POLICY "Patients can view their prescriptions"
ON public.prescriptions
FOR SELECT
USING (auth.uid() = patient_id);

CREATE POLICY "Admins can view all prescriptions"
ON public.prescriptions
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Indexes
CREATE INDEX idx_prescriptions_patient_id ON public.prescriptions(patient_id);
CREATE INDEX idx_prescriptions_clinician_id ON public.prescriptions(clinician_id);
CREATE INDEX idx_prescriptions_appointment_id ON public.prescriptions(appointment_id);

-- Trigger for updated_at
CREATE TRIGGER update_prescriptions_updated_at
BEFORE UPDATE ON public.prescriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
