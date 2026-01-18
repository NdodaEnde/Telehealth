-- Create consultation_messages table for in-call chat
CREATE TABLE public.consultation_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.consultation_sessions(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('patient', 'clinician')),
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'file', 'link')),
  content TEXT NOT NULL,
  file_url TEXT,
  file_name TEXT,
  file_size INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.consultation_messages ENABLE ROW LEVEL SECURITY;

-- Participants can view messages in their sessions
CREATE POLICY "Participants can view session messages"
ON public.consultation_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM consultation_sessions cs
    WHERE cs.id = session_id
    AND (cs.patient_id = auth.uid() OR cs.clinician_id = auth.uid())
  )
);

-- Participants can send messages to their sessions
CREATE POLICY "Participants can send messages"
ON public.consultation_messages
FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND EXISTS (
    SELECT 1 FROM consultation_sessions cs
    WHERE cs.id = session_id
    AND (cs.patient_id = auth.uid() OR cs.clinician_id = auth.uid())
  )
);

-- Create index for faster lookups
CREATE INDEX idx_consultation_messages_session ON public.consultation_messages(session_id);
CREATE INDEX idx_consultation_messages_created ON public.consultation_messages(created_at);

-- Enable realtime for chat messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.consultation_messages;

-- Create storage bucket for consultation attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('consultation-files', 'consultation-files', false, 10485760);

-- Storage policies for consultation files
CREATE POLICY "Authenticated users can upload consultation files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'consultation-files'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can view their consultation files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'consultation-files'
  AND auth.role() = 'authenticated'
);