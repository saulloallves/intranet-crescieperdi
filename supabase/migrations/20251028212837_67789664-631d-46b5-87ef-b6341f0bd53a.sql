-- Criar enum approval_source (se não existir)
DO $$ BEGIN
  CREATE TYPE approval_source AS ENUM ('admin', 'ai', 'auto');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Criar enum mural_status (se não existir)
DO $$ BEGIN
  CREATE TYPE mural_status AS ENUM ('pending', 'approved', 'rejected', 'flagged');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Tabela mural_posts
CREATE TABLE IF NOT EXISTS public.mural_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category mural_category NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  media_url TEXT,
  status mural_status DEFAULT 'pending' NOT NULL,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  approval_source approval_source,
  rejection_reason TEXT,
  ai_analysis JSONB,
  response_count INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indexes mural_posts
CREATE INDEX IF NOT EXISTS idx_mural_posts_status ON public.mural_posts(status);
CREATE INDEX IF NOT EXISTS idx_mural_posts_category ON public.mural_posts(category);
CREATE INDEX IF NOT EXISTS idx_mural_posts_author ON public.mural_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_mural_posts_created ON public.mural_posts(created_at DESC);

-- Tabela mural_responses
CREATE TABLE IF NOT EXISTS public.mural_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.mural_posts(id) ON DELETE CASCADE,
  responder_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  status mural_status DEFAULT 'pending' NOT NULL,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indexes mural_responses
CREATE INDEX IF NOT EXISTS idx_mural_responses_post ON public.mural_responses(post_id);
CREATE INDEX IF NOT EXISTS idx_mural_responses_responder ON public.mural_responses(responder_id);
CREATE INDEX IF NOT EXISTS idx_mural_responses_status ON public.mural_responses(status);
CREATE INDEX IF NOT EXISTS idx_mural_responses_created ON public.mural_responses(created_at DESC);

-- Tabela mural_settings
CREATE TABLE IF NOT EXISTS public.mural_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index mural_settings
CREATE INDEX IF NOT EXISTS idx_mural_settings_key ON public.mural_settings(key);

-- RLS Policies para mural_posts
ALTER TABLE public.mural_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can create own posts" ON public.mural_posts;
CREATE POLICY "Users can create own posts" ON public.mural_posts
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "Users can view approved posts" ON public.mural_posts;
CREATE POLICY "Users can view approved posts" ON public.mural_posts
  FOR SELECT TO authenticated
  USING (status = 'approved' OR author_id = auth.uid() OR has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update posts" ON public.mural_posts;
CREATE POLICY "Admins can update posts" ON public.mural_posts
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete posts" ON public.mural_posts;
CREATE POLICY "Admins can delete posts" ON public.mural_posts
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies para mural_responses
ALTER TABLE public.mural_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can create own responses" ON public.mural_responses;
CREATE POLICY "Users can create own responses" ON public.mural_responses
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = responder_id);

DROP POLICY IF EXISTS "Users can view approved responses" ON public.mural_responses;
CREATE POLICY "Users can view approved responses" ON public.mural_responses
  FOR SELECT TO authenticated
  USING (status = 'approved' OR responder_id = auth.uid() OR has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update responses" ON public.mural_responses;
CREATE POLICY "Admins can update responses" ON public.mural_responses
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete responses" ON public.mural_responses;
CREATE POLICY "Admins can delete responses" ON public.mural_responses
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies para mural_settings
ALTER TABLE public.mural_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can view settings" ON public.mural_settings;
CREATE POLICY "Everyone can view settings" ON public.mural_settings
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can manage settings" ON public.mural_settings;
CREATE POLICY "Admins can manage settings" ON public.mural_settings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_mural_updated_at()
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

DROP TRIGGER IF EXISTS update_mural_posts_updated_at ON public.mural_posts;
CREATE TRIGGER update_mural_posts_updated_at
  BEFORE UPDATE ON public.mural_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_mural_updated_at();

DROP TRIGGER IF EXISTS update_mural_responses_updated_at ON public.mural_responses;
CREATE TRIGGER update_mural_responses_updated_at
  BEFORE UPDATE ON public.mural_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_mural_updated_at();

DROP TRIGGER IF EXISTS update_mural_settings_updated_at ON public.mural_settings;
CREATE TRIGGER update_mural_settings_updated_at
  BEFORE UPDATE ON public.mural_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_mural_updated_at();

-- Trigger para contagem de respostas
CREATE OR REPLACE FUNCTION public.update_mural_response_count()
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

DROP TRIGGER IF EXISTS update_mural_response_count_trigger ON public.mural_responses;
CREATE TRIGGER update_mural_response_count_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.mural_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_mural_response_count();

-- Configurações iniciais
INSERT INTO public.mural_settings (key, value) VALUES
  ('auto_approval_enabled', 'false'::jsonb),
  ('ai_prompt_filter', '"Analise este post e determine se contém conteúdo inadequado, ofensivo ou sensível. Retorne JSON com: {\"is_appropriate\": boolean, \"risk_level\": \"low\"|\"medium\"|\"high\", \"concerns\": [\"lista de preocupações\"], \"recommendation\": \"approve\"|\"flag\"|\"reject\"}"'::jsonb),
  ('ai_prompt_validation', '"Analise este post e sugira melhorias para torná-lo mais claro, respeitoso e construtivo. Retorne JSON com: {\"is_valid\": boolean, \"suggestions\": [\"lista de sugestões\"], \"tone\": \"positive\"|\"neutral\"|\"negative\"}"'::jsonb),
  ('ai_sensitivity', '"medium"'::jsonb),
  ('notify_on_reply', 'true'::jsonb),
  ('feed_integration', 'true'::jsonb),
  ('allow_media', 'true'::jsonb),
  ('curator_roles', '["admin"]'::jsonb)
ON CONFLICT (key) DO NOTHING;