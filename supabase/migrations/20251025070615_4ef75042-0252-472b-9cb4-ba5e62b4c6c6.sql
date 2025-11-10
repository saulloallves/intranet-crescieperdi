-- Add whatsapp notifications preference to profiles
ALTER TABLE public.profiles 
ADD COLUMN receive_whatsapp_notifications BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.profiles.receive_whatsapp_notifications IS 'Indica se o usuário deseja receber notificações via WhatsApp';

-- Create automation settings table
CREATE TABLE IF NOT EXISTS public.automation_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.automation_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can manage automation settings
CREATE POLICY "Only admins can manage automation settings"
  ON public.automation_settings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Everyone can view automation settings
CREATE POLICY "Everyone can view automation settings"
  ON public.automation_settings
  FOR SELECT
  USING (true);

-- Insert default automation settings
INSERT INTO public.automation_settings (key, value, description) VALUES
  ('auto_notifications_enabled', 'false', 'Enviar notificações automaticamente para novos conteúdos'),
  ('whatsapp_queue_delay_min', '3', 'Delay mínimo em segundos entre mensagens WhatsApp'),
  ('whatsapp_queue_delay_max', '5', 'Delay máximo em segundos entre mensagens WhatsApp'),
  ('welcome_message_enabled', 'false', 'Enviar mensagem de boas-vindas automática para novos usuários'),
  ('password_recovery_whatsapp', 'true', 'Enviar senha via WhatsApp na recuperação')
ON CONFLICT (key) DO NOTHING;