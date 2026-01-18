-- Create consultation sessions table for WebRTC signaling
CREATE TABLE public.consultation_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL,
    clinician_id UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'connected', 'ended')),
    patient_joined_at TIMESTAMP WITH TIME ZONE,
    clinician_joined_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(appointment_id)
);

-- Enable RLS
ALTER TABLE public.consultation_sessions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Patients can view their sessions"
ON public.consultation_sessions FOR SELECT
USING (auth.uid() = patient_id);

CREATE POLICY "Clinicians can view their sessions"
ON public.consultation_sessions FOR SELECT
USING (auth.uid() = clinician_id);

CREATE POLICY "Patients can create sessions for their appointments"
ON public.consultation_sessions FOR INSERT
WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Clinicians can create sessions for their appointments"
ON public.consultation_sessions FOR INSERT
WITH CHECK (auth.uid() = clinician_id);

CREATE POLICY "Participants can update their sessions"
ON public.consultation_sessions FOR UPDATE
USING (auth.uid() = patient_id OR auth.uid() = clinician_id);

-- Enable realtime for consultation sessions
ALTER PUBLICATION supabase_realtime ADD TABLE public.consultation_sessions;