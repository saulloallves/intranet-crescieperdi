-- ====================================
-- MURAL CRESCI E PERDI - DATABASE SETUP
-- ====================================

-- Criar enums
CREATE TYPE mural_category AS ENUM (
  'fornecedores',
  'operacional',
  'sistema',
  'vendas',
  'treinamento',
  'juridico',
  'ideias'
);

CREATE TYPE approval_source AS ENUM ('ai', 'manual');

CREATE TYPE mural_status AS ENUM ('pending', 'approved', 'rejected');

-- ====================================
-- TABELA: mural_posts
-- ====================================
CREATE TABLE public.mural_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category mural_category NOT NULL,
  content TEXT NOT NULL,
  content_clean TEXT,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status mural_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  approved_at TIMESTAMP WITH TIME ZONE,
  approval_source approval_source,
  ai_reason TEXT,
  response_count INTEGER NOT NULL DEFAULT 0,
  media_url TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices de performance
CREATE INDEX idx_mural_posts_status ON public.mural_posts(status);
CREATE INDEX idx_mural_posts_category ON public.mural_posts(category);
CREATE INDEX idx_mural_posts_author ON public.mural_posts(author_id);
CREATE INDEX idx_mural_posts_created_at ON public.mural_posts(created_at DESC);

-- RLS Policies
ALTER TABLE public.mural_posts ENABLE ROW LEVEL SECURITY;

-- Usuários podem criar próprias postagens
CREATE POLICY "Users can create own posts"
ON public.mural_posts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = author_id);

-- Usuários podem ver postagens aprovadas (anônimas)
CREATE POLICY "Users can view approved posts"
ON public.mural_posts
FOR SELECT
TO authenticated
USING (status = 'approved');

-- Admins e gestores podem ver todas as postagens
CREATE POLICY "Admins can view all posts"
ON public.mural_posts
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'gestor_setor')
  )
);

-- Admins e gestores podem atualizar postagens
CREATE POLICY "Admins can update posts"
ON public.mural_posts
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'gestor_setor')
  )
);

-- Admins podem deletar postagens
CREATE POLICY "Admins can delete posts"
ON public.mural_posts
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

-- ====================================
-- TABELA: mural_responses
-- ====================================
CREATE TABLE public.mural_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.mural_posts(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  content_clean TEXT,
  responder_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status mural_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  approved_at TIMESTAMP WITH TIME ZONE,
  approval_source approval_source,
  ai_reason TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices de performance
CREATE INDEX idx_mural_responses_post ON public.mural_responses(post_id);
CREATE INDEX idx_mural_responses_status ON public.mural_responses(status);
CREATE INDEX idx_mural_responses_responder ON public.mural_responses(responder_id);
CREATE INDEX idx_mural_responses_created_at ON public.mural_responses(created_at DESC);

-- RLS Policies
ALTER TABLE public.mural_responses ENABLE ROW LEVEL SECURITY;

-- Usuários podem criar próprias respostas
CREATE POLICY "Users can create own responses"
ON public.mural_responses
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = responder_id);

-- Usuários podem ver respostas aprovadas
CREATE POLICY "Users can view approved responses"
ON public.mural_responses
FOR SELECT
TO authenticated
USING (status = 'approved');

-- Admins e gestores podem ver todas as respostas
CREATE POLICY "Admins can view all responses"
ON public.mural_responses
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'gestor_setor')
  )
);

-- Admins e gestores podem atualizar respostas
CREATE POLICY "Admins can update responses"
ON public.mural_responses
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'gestor_setor')
  )
);

-- Admins podem deletar respostas
CREATE POLICY "Admins can delete responses"
ON public.mural_responses
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

-- ====================================
-- TABELA: mural_settings
-- ====================================
CREATE TABLE public.mural_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índice
CREATE INDEX idx_mural_settings_key ON public.mural_settings(key);

-- RLS Policies
ALTER TABLE public.mural_settings ENABLE ROW LEVEL SECURITY;

-- Todos podem ver settings
CREATE POLICY "Everyone can view mural settings"
ON public.mural_settings
FOR SELECT
TO authenticated
USING (true);

-- Apenas admins podem gerenciar settings
CREATE POLICY "Only admins can manage mural settings"
ON public.mural_settings
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

-- ====================================
-- TRIGGERS
-- ====================================

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_mural_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_mural_posts_updated_at
BEFORE UPDATE ON public.mural_posts
FOR EACH ROW
EXECUTE FUNCTION update_mural_updated_at();

CREATE TRIGGER update_mural_responses_updated_at
BEFORE UPDATE ON public.mural_responses
FOR EACH ROW
EXECUTE FUNCTION update_mural_updated_at();

CREATE TRIGGER update_mural_settings_updated_at
BEFORE UPDATE ON public.mural_settings
FOR EACH ROW
EXECUTE FUNCTION update_mural_updated_at();

-- Trigger para atualizar contador de respostas
CREATE OR REPLACE FUNCTION update_mural_response_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'approved' THEN
    UPDATE public.mural_posts
    SET response_count = response_count + 1
    WHERE id = NEW.post_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.status != 'approved' AND NEW.status = 'approved' THEN
    UPDATE public.mural_posts
    SET response_count = response_count + 1
    WHERE id = NEW.post_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'approved' AND NEW.status != 'approved' THEN
    UPDATE public.mural_posts
    SET response_count = GREATEST(0, response_count - 1)
    WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' AND OLD.status = 'approved' THEN
    UPDATE public.mural_posts
    SET response_count = GREATEST(0, response_count - 1)
    WHERE id = OLD.post_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER update_mural_response_count_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.mural_responses
FOR EACH ROW
EXECUTE FUNCTION update_mural_response_count();

-- ====================================
-- CONFIGURAÇÕES INICIAIS
-- ====================================
INSERT INTO public.mural_settings (key, value, description) VALUES
('auto_approval_enabled', 'true', 'Ativar aprovação automática via IA'),
('ai_prompt_filter', '"Leia o texto a seguir e substitua, oculte ou omita qualquer elemento que identifique o autor ou terceiros (nome, loja, cidade, código, contato, etc.). Mantenha o sentido da mensagem e a linguagem natural. O resultado deve parecer uma publicação neutra, sem identidade."', 'Prompt para anonimização de conteúdo'),
('ai_prompt_validation', '"Avalie se a publicação está dentro dos parâmetros institucionais (colaborativa, respeitosa, útil, sem críticas diretas ou identificação). Se estiver adequada, retorne ''Aprovado''. Caso contrário, retorne ''Revisar''."', 'Prompt para aprovação automática'),
('ai_sensitivity', '3', 'Nível de rigidez da filtragem (1-5)'),
('notify_on_reply', 'true', 'Enviar notificação quando há resposta'),
('feed_integration', 'false', 'Exibir publicações no feed principal'),
('allow_media', 'true', 'Permite imagens nas postagens'),
('curator_roles', '["admin", "gestor_setor"]', 'Perfis com permissão de curadoria')
ON CONFLICT (key) DO NOTHING;