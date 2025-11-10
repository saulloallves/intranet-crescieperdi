-- Add phone column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN phone TEXT;

-- Add comment to the column
COMMENT ON COLUMN public.profiles.phone IS 'WhatsApp phone number in format: 5511999999999';