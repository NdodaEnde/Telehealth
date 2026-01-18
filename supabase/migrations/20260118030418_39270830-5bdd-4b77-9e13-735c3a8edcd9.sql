-- Add in_progress to the appointment_status enum
ALTER TYPE public.appointment_status ADD VALUE IF NOT EXISTS 'in_progress' AFTER 'confirmed';