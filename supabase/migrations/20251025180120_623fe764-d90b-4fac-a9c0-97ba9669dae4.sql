-- Adicionar campos de configuração de tempo nos checklists
ALTER TABLE public.checklists
ADD COLUMN IF NOT EXISTS reminder_time text,
ADD COLUMN IF NOT EXISTS deadline_time text,
ADD COLUMN IF NOT EXISTS alert_after_deadline boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS alert_recipients text[],
ADD COLUMN IF NOT EXISTS applicable_units text[];

-- Criar tabela de alertas de checklist
CREATE TABLE IF NOT EXISTS public.checklist_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id uuid REFERENCES public.checklists(id) ON DELETE CASCADE,
  unit_code text NOT NULL,
  sent_via text[] NOT NULL,
  sent_at timestamp with time zone DEFAULT now(),
  resolved boolean DEFAULT false,
  resolved_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

-- Criar tabela de relatórios automáticos
CREATE TABLE IF NOT EXISTS public.checklist_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type text NOT NULL, -- 'daily', 'weekly'
  period_start date NOT NULL,
  period_end date NOT NULL,
  content text NOT NULL,
  metrics jsonb,
  generated_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.checklist_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_reports ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para checklist_alerts
CREATE POLICY "Admins can view all alerts"
ON public.checklist_alerts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'gestor_setor')
  )
);

CREATE POLICY "System can create alerts"
ON public.checklist_alerts
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can update alerts"
ON public.checklist_alerts
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'gestor_setor')
  )
);

-- Políticas RLS para checklist_reports
CREATE POLICY "Admins can view all reports"
ON public.checklist_reports
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'gestor_setor')
  )
);

CREATE POLICY "System can create reports"
ON public.checklist_reports
FOR INSERT
WITH CHECK (true);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_checklist_alerts_unit ON public.checklist_alerts(unit_code);
CREATE INDEX IF NOT EXISTS idx_checklist_alerts_sent_at ON public.checklist_alerts(sent_at);
CREATE INDEX IF NOT EXISTS idx_checklist_alerts_resolved ON public.checklist_alerts(resolved);
CREATE INDEX IF NOT EXISTS idx_checklist_reports_period ON public.checklist_reports(period_start, period_end);