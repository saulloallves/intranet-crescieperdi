-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage on cron schema to postgres
GRANT USAGE ON SCHEMA cron TO postgres;

-- Remove existing cron job if it exists (to avoid duplicates)
SELECT cron.unschedule('check-checklist-compliance-hourly') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'check-checklist-compliance-hourly'
);

-- Schedule the checklist compliance check to run every hour
SELECT cron.schedule(
  'check-checklist-compliance-hourly',
  '0 * * * *', -- Every hour at minute 0
  $$
  SELECT
    net.http_post(
      url:='https://sgeabunxaunzoedwvvox.supabase.co/functions/v1/check-checklist-compliance',
      headers:='{"Content-Type": "application/json"}'::jsonb
    ) as request_id;
  $$
);

-- Add default automation settings if they don't exist
INSERT INTO public.automation_settings (key, value, description)
VALUES 
  ('push_enabled', 'true'::jsonb, 'Enviar notificações push internas para checklists pendentes')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.automation_settings (key, value, description)
VALUES 
  ('enable_zapi_alerts', 'false'::jsonb, 'Enviar alertas via WhatsApp quando checklists não são enviados no prazo')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.automation_settings (key, value, description)
VALUES 
  ('alert_repeat_interval', '2'::jsonb, 'Intervalo em horas para reenviar alertas de checklists pendentes')
ON CONFLICT (key) DO NOTHING;

-- Create index on automation_settings.key for better performance
CREATE INDEX IF NOT EXISTS idx_automation_settings_key ON public.automation_settings(key);