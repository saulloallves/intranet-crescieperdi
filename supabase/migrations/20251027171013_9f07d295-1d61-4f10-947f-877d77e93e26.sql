-- =====================================================
-- FASE 1: MÓDULO DE CONTEÚDOS OBRIGATÓRIOS
-- Criação de tabelas, RLS policies e configurações
-- =====================================================

-- 1. CRIAR TABELA: mandatory_contents
-- Armazena vídeos e textos obrigatórios com quiz
CREATE TABLE IF NOT EXISTS public.mandatory_contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('video', 'text')),
  content_url TEXT,
  content_text TEXT,
  target_audience TEXT NOT NULL DEFAULT 'ambos' 
    CHECK (target_audience IN ('colaboradores', 'franqueados', 'ambos')),
  quiz_questions JSONB,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.mandatory_contents IS 'Conteúdos obrigatórios (vídeos ou textos) que bloqueiam acesso até conclusão';
COMMENT ON COLUMN public.mandatory_contents.quiz_questions IS 'Array JSON com perguntas geradas pela IA para avaliação de compreensão';
COMMENT ON COLUMN public.mandatory_contents.target_audience IS 'Define o público-alvo: colaboradores, franqueados ou ambos';

CREATE INDEX IF NOT EXISTS idx_mandatory_contents_active ON public.mandatory_contents(active);
CREATE INDEX IF NOT EXISTS idx_mandatory_contents_target_audience ON public.mandatory_contents(target_audience);
CREATE INDEX IF NOT EXISTS idx_mandatory_contents_created_by ON public.mandatory_contents(created_by);

CREATE TRIGGER mandatory_contents_updated_at
  BEFORE UPDATE ON public.mandatory_contents
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.mandatory_contents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and gestores can manage mandatory contents"
  ON public.mandatory_contents FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'gestor_setor')
    )
  );

CREATE POLICY "Users can view active mandatory contents"
  ON public.mandatory_contents FOR SELECT
  USING (active = true);

-- =====================================================
-- 2. CRIAR TABELA: mandatory_content_signatures
-- Registros de conclusão e assinaturas digitais
-- =====================================================

CREATE TABLE IF NOT EXISTS public.mandatory_content_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL REFERENCES public.mandatory_contents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  score INT CHECK (score >= 0 AND score <= 100),
  confirmed BOOLEAN DEFAULT false,
  confirmation_text TEXT,
  ip_address TEXT,
  success BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_content_user UNIQUE(content_id, user_id)
);

COMMENT ON TABLE public.mandatory_content_signatures IS 'Assinaturas digitais e registros de conclusão de conteúdos obrigatórios';
COMMENT ON COLUMN public.mandatory_content_signatures.score IS 'Pontuação no quiz (0-100), NULL para vídeos';
COMMENT ON COLUMN public.mandatory_content_signatures.ip_address IS 'IP do usuário no momento da assinatura (auditoria)';
COMMENT ON COLUMN public.mandatory_content_signatures.success IS 'true = Passou na avaliação e confirmou ciência';

CREATE INDEX IF NOT EXISTS idx_mandatory_signatures_content ON public.mandatory_content_signatures(content_id);
CREATE INDEX IF NOT EXISTS idx_mandatory_signatures_user ON public.mandatory_content_signatures(user_id);
CREATE INDEX IF NOT EXISTS idx_mandatory_signatures_success ON public.mandatory_content_signatures(success);

ALTER TABLE public.mandatory_content_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create own signatures"
  ON public.mandatory_content_signatures FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own signatures"
  ON public.mandatory_content_signatures FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all signatures"
  ON public.mandatory_content_signatures FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'gestor_setor')
    )
  );

CREATE POLICY "Admins can manage all signatures"
  ON public.mandatory_content_signatures FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'gestor_setor')
    )
  );

-- =====================================================
-- 3. CRIAR TABELA: mandatory_content_reminders
-- Controle de lembretes enviados via WhatsApp e Push
-- =====================================================

CREATE TABLE IF NOT EXISTS public.mandatory_content_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL REFERENCES public.mandatory_contents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'push')),
  message_template TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT now(),
  delivered BOOLEAN DEFAULT false
);

COMMENT ON TABLE public.mandatory_content_reminders IS 'Registro de lembretes enviados aos usuários sobre conteúdos pendentes';
COMMENT ON COLUMN public.mandatory_content_reminders.channel IS 'Canal de envio: whatsapp ou push notification';

CREATE INDEX IF NOT EXISTS idx_mandatory_reminders_content ON public.mandatory_content_reminders(content_id);
CREATE INDEX IF NOT EXISTS idx_mandatory_reminders_user ON public.mandatory_content_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_mandatory_reminders_sent_at ON public.mandatory_content_reminders(sent_at);

ALTER TABLE public.mandatory_content_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all reminders"
  ON public.mandatory_content_reminders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'gestor_setor')
    )
  );

CREATE POLICY "System can create reminders"
  ON public.mandatory_content_reminders FOR INSERT
  WITH CHECK (true);

-- =====================================================
-- 4. ADICIONAR CONFIGURAÇÕES NA TABELA settings
-- Parâmetros globais do módulo
-- =====================================================

INSERT INTO public.settings (key, value, description) VALUES
  (
    'mandatory_content_block_access', 
    'true', 
    'Bloqueia acesso global à intranet se houver conteúdo obrigatório pendente'
  ),
  (
    'mandatory_content_reminder_frequency', 
    '"daily"', 
    'Frequência de envio de lembretes: daily (diário) ou weekly (semanal)'
  ),
  (
    'mandatory_content_quiz_auto_generate', 
    'true', 
    'Ativa geração automática de quiz via IA para conteúdos textuais'
  ),
  (
    'mandatory_content_require_100_percent_video', 
    'true', 
    'Exige que o usuário assista o vídeo até o final (100%)'
  ),
  (
    'mandatory_content_signature_pdf_enabled', 
    'false', 
    'Gera comprovante de ciência em PDF (recurso futuro)'
  ),
  (
    'mandatory_content_whatsapp_batch_limit', 
    '50', 
    'Número máximo de lembretes WhatsApp por lote diário'
  ),
  (
    'mandatory_content_reminder_time', 
    '"10:00"', 
    'Horário fixo de envio diário de lembretes (formato HH:MM)'
  ),
  (
    'mandatory_content_max_reminders', 
    '5', 
    'Número máximo de lembretes enviados por conteúdo antes de parar'
  )
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = now();

-- =====================================================
-- 5. GRANTS DE PERMISSÕES
-- Garantir acesso adequado às tabelas
-- =====================================================

GRANT SELECT, INSERT ON public.mandatory_contents TO authenticated;
GRANT SELECT, INSERT ON public.mandatory_content_signatures TO authenticated;
GRANT SELECT ON public.mandatory_content_reminders TO authenticated;

GRANT ALL ON public.mandatory_contents TO service_role;
GRANT ALL ON public.mandatory_content_signatures TO service_role;
GRANT ALL ON public.mandatory_content_reminders TO service_role;