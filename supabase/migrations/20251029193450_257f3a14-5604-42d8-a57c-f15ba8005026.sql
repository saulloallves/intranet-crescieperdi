-- Expandir tabela notifications existente
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'push' CHECK (channel IN ('push', 'whatsapp', 'email')),
ADD COLUMN IF NOT EXISTS unit_code TEXT,
ADD COLUMN IF NOT EXISTS module TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'sent' CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ DEFAULT now(),
ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS delivery_report JSONB;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_notifications_channel ON public.notifications(channel);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON public.notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_module ON public.notifications(module);
CREATE INDEX IF NOT EXISTS idx_notifications_sent_at ON public.notifications(sent_at);

-- Criar tabela de templates
CREATE TABLE public.notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message_template TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'push', 'email')),
  variables JSONB DEFAULT '[]',
  created_by UUID REFERENCES public.profiles(id),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Criar tabela de estatísticas
CREATE TABLE public.notification_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  module TEXT,
  total_sent INTEGER DEFAULT 0,
  total_read INTEGER DEFAULT 0,
  read_rate DECIMAL(5,2) DEFAULT 0,
  average_delay INTEGER DEFAULT 0,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Criar tabela de configurações de notificação
CREATE TABLE public.notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger para updated_at nos templates
CREATE TRIGGER update_notification_templates_updated_at
  BEFORE UPDATE ON public.notification_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- RLS Policies
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

-- Policies para templates (apenas admins podem gerenciar)
CREATE POLICY "Admins can manage templates" ON public.notification_templates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Policies para stats (apenas admins podem ver)
CREATE POLICY "Admins can view stats" ON public.notification_stats
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Policies para settings (apenas admins)
CREATE POLICY "Admins can manage settings" ON public.notification_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Inserir configurações padrão
INSERT INTO public.notification_settings (key, value, description) VALUES
('enable_zapi_whatsapp', 'true', 'Habilitar envio via WhatsApp'),
('zapi_instance_id', '""', 'ID da instância Z-API'),
('zapi_token', '""', 'Token Z-API'),
('default_push_sound', '"default"', 'Som padrão de push'),
('auto_retry_failed', 'true', 'Reenviar notificações com falha'),
('report_frequency', '"weekly"', 'Frequência de relatórios'),
('max_batch_send', '50', 'Limite de envios simultâneos'),
('notification_retention_days', '90', 'Dias para manter notificações');