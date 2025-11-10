-- Adicionar novos campos à tabela surveys
ALTER TABLE public.surveys
ADD COLUMN IF NOT EXISTS anonymous boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS scheduled_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS audience_units text[],
ADD COLUMN IF NOT EXISTS audience_roles text[];

-- Adicionar campo de unidade às respostas
ALTER TABLE public.survey_responses
ADD COLUMN IF NOT EXISTS unit_code text;

-- Criar tabela de relatórios automáticos de pesquisas
CREATE TABLE IF NOT EXISTS public.survey_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  avg_score numeric,
  participation_rate numeric,
  highlights jsonb,
  report_text text,
  generated_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

-- RLS para survey_reports
ALTER TABLE public.survey_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view survey reports"
  ON public.survey_reports
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'gestor_setor')
    )
  );

CREATE POLICY "System can create survey reports"
  ON public.survey_reports
  FOR INSERT
  WITH CHECK (true);

-- Criar tabela de alertas de clima
CREATE TABLE IF NOT EXISTS public.climate_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL,
  severity text NOT NULL,
  unit_code text,
  metric_value numeric NOT NULL,
  threshold numeric NOT NULL,
  message text NOT NULL,
  resolved boolean DEFAULT false,
  resolved_at timestamp with time zone,
  sent_via text[],
  created_at timestamp with time zone DEFAULT now()
);

-- RLS para climate_alerts
ALTER TABLE public.climate_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view climate alerts"
  ON public.climate_alerts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'gestor_setor')
    )
  );

CREATE POLICY "Admins can update climate alerts"
  ON public.climate_alerts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'gestor_setor')
    )
  );

CREATE POLICY "System can create climate alerts"
  ON public.climate_alerts
  FOR INSERT
  WITH CHECK (true);

-- Adicionar configurações de clima ao automation_settings
INSERT INTO public.automation_settings (key, value, description)
VALUES 
  ('climate_alert_threshold', '6.0', 'Média mínima antes de gerar alerta (1-10)')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.automation_settings (key, value, description)
VALUES 
  ('climate_critical_threshold', '5.0', 'Média crítica que gera alerta urgente (1-10)')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.automation_settings (key, value, description)
VALUES 
  ('climate_alert_weeks', '2', 'Número de semanas consecutivas abaixo do threshold para alerta')
ON CONFLICT (key) DO NOTHING;