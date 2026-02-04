-- Add authorization_number column to bookings table
-- This column stores the medical aid authorization number for medical aid bookings

ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS authorization_number TEXT;

-- Add comment for documentation
COMMENT ON COLUMN bookings.authorization_number IS 'Medical aid authorization number. Required for medical_aid billing type.';
