-- Expand trainings table to support modular structure
ALTER TABLE public.trainings
ADD COLUMN IF NOT EXISTS modules jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS certificate_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS min_score integer DEFAULT 70,
ADD COLUMN IF NOT EXISTS max_attempts integer DEFAULT 3;

COMMENT ON COLUMN public.trainings.modules IS 'Array of training modules with videos, PDFs, quizzes, and tasks';
COMMENT ON COLUMN public.trainings.certificate_enabled IS 'Automatically generate certificate upon completion';
COMMENT ON COLUMN public.trainings.min_score IS 'Minimum score required to pass (%)';
COMMENT ON COLUMN public.trainings.max_attempts IS 'Maximum quiz attempts allowed';

-- Expand training_progress to track scores and attempts
ALTER TABLE public.training_progress
ADD COLUMN IF NOT EXISTS score integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS quiz_attempts integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_module integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS modules_completed jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.training_progress.score IS 'Average score across all quizzes';
COMMENT ON COLUMN public.training_progress.quiz_attempts IS 'Number of quiz attempts made';
COMMENT ON COLUMN public.training_progress.current_module IS 'Index of current module being studied';
COMMENT ON COLUMN public.training_progress.modules_completed IS 'Array of completed module IDs';

-- Create training_certificates table
CREATE TABLE IF NOT EXISTS public.training_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  training_id uuid REFERENCES public.trainings(id) ON DELETE CASCADE,
  issued_at timestamp with time zone DEFAULT now(),
  pdf_url text,
  certificate_code text UNIQUE NOT NULL,
  verified boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

-- RLS policies for training_certificates
ALTER TABLE public.training_certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own certificates"
  ON public.training_certificates
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all certificates"
  ON public.training_certificates
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() 
      AND role = ANY(ARRAY['admin'::user_role, 'gestor_setor'::user_role])
    )
  );

CREATE POLICY "System can create certificates"
  ON public.training_certificates
  FOR INSERT
  WITH CHECK (true);

-- Create training_quiz_results table to track individual quiz attempts
CREATE TABLE IF NOT EXISTS public.training_quiz_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  training_id uuid REFERENCES public.trainings(id) ON DELETE CASCADE,
  module_id text NOT NULL,
  score integer NOT NULL,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  passed boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- RLS policies for training_quiz_results
ALTER TABLE public.training_quiz_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own quiz results"
  ON public.training_quiz_results
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own quiz results"
  ON public.training_quiz_results
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all quiz results"
  ON public.training_quiz_results
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() 
      AND role = ANY(ARRAY['admin'::user_role, 'gestor_setor'::user_role])
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_training_certificates_user_id ON public.training_certificates(user_id);
CREATE INDEX IF NOT EXISTS idx_training_certificates_training_id ON public.training_certificates(training_id);
CREATE INDEX IF NOT EXISTS idx_training_certificates_code ON public.training_certificates(certificate_code);
CREATE INDEX IF NOT EXISTS idx_quiz_results_user_training ON public.training_quiz_results(user_id, training_id);

-- Add settings for training automation
INSERT INTO public.automation_settings (key, value, description)
VALUES 
  ('training_auto_assign', '{"enabled": true}'::jsonb, 'Automatically assign trainings on user creation'),
  ('training_role_mapping', '{"colaborador": [], "gerente": [], "franqueado": []}'::jsonb, 'Map roles to training IDs for auto-assignment'),
  ('training_certificate_template', '{"enabled": true, "logo_url": "", "signature_name": "Cresci e Perdi"}'::jsonb, 'Certificate generation settings')
ON CONFLICT (key) DO NOTHING;