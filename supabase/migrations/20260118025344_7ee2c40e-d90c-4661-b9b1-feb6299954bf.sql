-- Create symptom categories enum
CREATE TYPE public.symptom_severity AS ENUM ('mild', 'moderate', 'severe');
CREATE TYPE public.appointment_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed');
CREATE TYPE public.consultation_type AS ENUM ('video', 'phone', 'in_person');

-- Create symptom assessments table
CREATE TABLE public.symptom_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    symptoms TEXT[] NOT NULL,
    severity symptom_severity NOT NULL DEFAULT 'mild',
    description TEXT,
    recommended_specialization TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create clinician availability table
CREATE TABLE public.clinician_availability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinician_id UUID NOT NULL REFERENCES public.clinician_profiles(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

-- Create appointments table
CREATE TABLE public.appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    clinician_id UUID NOT NULL REFERENCES public.clinician_profiles(id) ON DELETE CASCADE,
    symptom_assessment_id UUID REFERENCES public.symptom_assessments(id) ON DELETE SET NULL,
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    consultation_type consultation_type NOT NULL DEFAULT 'video',
    status appointment_status NOT NULL DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.symptom_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinician_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Symptom assessments policies
CREATE POLICY "Patients can view their own assessments"
ON public.symptom_assessments FOR SELECT
USING (auth.uid() = patient_id);

CREATE POLICY "Patients can create their own assessments"
ON public.symptom_assessments FOR INSERT
WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Clinicians can view assessments for their appointments"
ON public.symptom_assessments FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.appointments a
        WHERE a.symptom_assessment_id = id
        AND a.clinician_id = auth.uid()
    )
);

-- Clinician availability policies
CREATE POLICY "Anyone can view active availability"
ON public.clinician_availability FOR SELECT
USING (is_active = true);

CREATE POLICY "Clinicians can manage their own availability"
ON public.clinician_availability FOR ALL
USING (auth.uid() = clinician_id)
WITH CHECK (auth.uid() = clinician_id);

-- Appointments policies
CREATE POLICY "Patients can view their own appointments"
ON public.appointments FOR SELECT
USING (auth.uid() = patient_id);

CREATE POLICY "Patients can create appointments"
ON public.appointments FOR INSERT
WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Patients can update their pending appointments"
ON public.appointments FOR UPDATE
USING (auth.uid() = patient_id AND status = 'pending');

CREATE POLICY "Clinicians can view their appointments"
ON public.appointments FOR SELECT
USING (auth.uid() = clinician_id);

CREATE POLICY "Clinicians can update their appointments"
ON public.appointments FOR UPDATE
USING (auth.uid() = clinician_id);

CREATE POLICY "Admins can view all appointments"
ON public.appointments FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Create triggers for updated_at
CREATE TRIGGER update_clinician_availability_updated_at
BEFORE UPDATE ON public.clinician_availability
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at
BEFORE UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();