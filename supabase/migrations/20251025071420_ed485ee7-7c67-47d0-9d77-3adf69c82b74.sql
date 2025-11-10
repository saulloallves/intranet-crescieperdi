-- Create surveys table
CREATE TABLE public.surveys (
  id UUID NOT NULL DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  target_audience TEXT NOT NULL CHECK (target_audience IN ('colaborador', 'franqueado', 'ambos')),
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  show_results BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create survey_responses table
CREATE TABLE public.survey_responses (
  id UUID NOT NULL DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
  survey_id UUID REFERENCES public.surveys(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for surveys
CREATE POLICY "Admins can manage surveys"
  ON public.surveys
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'gestor_setor')
    )
  );

CREATE POLICY "Users can view active surveys"
  ON public.surveys
  FOR SELECT
  USING (is_active = true);

-- RLS Policies for survey_responses
CREATE POLICY "Users can create own responses"
  ON public.survey_responses
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own responses"
  ON public.survey_responses
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all responses"
  ON public.survey_responses
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'gestor_setor')
    )
  );

-- Create trigger for updated_at
CREATE TRIGGER update_surveys_updated_at
  BEFORE UPDATE ON public.surveys
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Create index for better performance
CREATE INDEX idx_survey_responses_survey_id ON public.survey_responses(survey_id);
CREATE INDEX idx_survey_responses_user_id ON public.survey_responses(user_id);