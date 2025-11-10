-- Add cpf column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN cpf TEXT;

-- Add comment to the column
COMMENT ON COLUMN public.profiles.cpf IS 'CPF do usuário (apenas números)';