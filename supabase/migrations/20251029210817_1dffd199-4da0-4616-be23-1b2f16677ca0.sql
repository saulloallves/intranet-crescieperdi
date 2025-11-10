-- Create tables for GiraBot advanced analytics and curation

-- Table for storing AI sessions with detailed metrics
CREATE TABLE IF NOT EXISTS public.ai_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  module TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT,
  tokens_used INTEGER DEFAULT 0,
  response_time_ms INTEGER DEFAULT 0,
  model_used TEXT DEFAULT 'google/gemini-2.5-flash',
  feedback_rating INTEGER CHECK (feedback_rating >= 1 AND feedback_rating <= 5),
  feedback_comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table for dynamic FAQs
CREATE TABLE IF NOT EXISTS public.girabot_faqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category TEXT NOT NULL,
  module TEXT,
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Table for GiraBot settings
CREATE TABLE IF NOT EXISTS public.girabot_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default settings
INSERT INTO public.girabot_settings (key, value, description) VALUES
('ai_parameters', '{"temperature": 0.7, "max_tokens": 1000, "context_depth": 10}', 'Parâmetros de IA para geração de respostas'),
('usage_limits', '{"daily_limit": 1000, "per_user_limit": 50, "alert_threshold": 800}', 'Limites de uso do sistema'),
('module_integrations', '{"feed": true, "treinamentos": true, "mural": true, "ideias": true}', 'Módulos integrados com o GiraBot'),
('alert_settings', '{"enable_smart_alerts": true, "alert_frequency": "6h", "notify_via_whatsapp": true}', 'Configurações de alertas inteligentes')
ON CONFLICT (key) DO NOTHING;

-- Enable RLS
ALTER TABLE public.ai_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.girabot_faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.girabot_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_sessions
CREATE POLICY "Admins can view all sessions"
ON public.ai_sessions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = ANY(ARRAY['admin'::user_role, 'gestor_setor'::user_role])
  )
);

CREATE POLICY "Users can view own sessions"
ON public.ai_sessions
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "System can create sessions"
ON public.ai_sessions
FOR INSERT
TO authenticated
WITH CHECK (true);

-- RLS Policies for girabot_faqs
CREATE POLICY "Everyone can view active FAQs"
ON public.girabot_faqs
FOR SELECT
TO authenticated
USING (is_active = true);

CREATE POLICY "Admins can manage FAQs"
ON public.girabot_faqs
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = ANY(ARRAY['admin'::user_role, 'gestor_setor'::user_role])
  )
);

-- RLS Policies for girabot_settings
CREATE POLICY "Everyone can view settings"
ON public.girabot_settings
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage settings"
ON public.girabot_settings
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'::user_role
  )
);

-- Create indexes for performance
CREATE INDEX idx_ai_sessions_user_id ON public.ai_sessions(user_id);
CREATE INDEX idx_ai_sessions_module ON public.ai_sessions(module);
CREATE INDEX idx_ai_sessions_created_at ON public.ai_sessions(created_at DESC);
CREATE INDEX idx_girabot_faqs_category ON public.girabot_faqs(category);
CREATE INDEX idx_girabot_faqs_active ON public.girabot_faqs(is_active) WHERE is_active = true;

-- Function to update FAQ updated_at
CREATE OR REPLACE FUNCTION update_faq_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_girabot_faqs_updated_at
BEFORE UPDATE ON public.girabot_faqs
FOR EACH ROW
EXECUTE FUNCTION update_faq_updated_at();