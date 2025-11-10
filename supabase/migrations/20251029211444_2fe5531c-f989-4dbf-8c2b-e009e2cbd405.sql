-- Create table for storing GiraBot reports
CREATE TABLE IF NOT EXISTS public.girabot_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type TEXT NOT NULL DEFAULT 'daily',
  report_data JSONB NOT NULL DEFAULT '{}',
  ai_insights TEXT,
  generated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.girabot_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for girabot_reports
CREATE POLICY "Admins can view all reports"
ON public.girabot_reports
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = ANY(ARRAY['admin'::user_role, 'gestor_setor'::user_role])
  )
);

CREATE POLICY "System can create reports"
ON public.girabot_reports
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Create index for performance
CREATE INDEX idx_girabot_reports_generated_at ON public.girabot_reports(generated_at DESC);
CREATE INDEX idx_girabot_reports_type ON public.girabot_reports(report_type);