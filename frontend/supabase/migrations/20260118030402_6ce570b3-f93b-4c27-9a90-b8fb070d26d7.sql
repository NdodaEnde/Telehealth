-- Add in_progress status to appointments if not already supported
-- Also enable realtime for appointments table

-- Enable realtime for appointments
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;