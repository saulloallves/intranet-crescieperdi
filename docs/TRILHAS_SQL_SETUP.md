# Configuração de Trilhas de Treinamento

## Instruções de Instalação

Para habilitar o módulo de **Trilhas de Treinamento** (Jornadas Personalizadas), execute o SQL abaixo no **Supabase Dashboard > SQL Editor**.

## SQL de Configuração

```sql
-- ============================================
-- TRILHAS DE TREINAMENTO - SETUP COMPLETO
-- ============================================

-- 1. Criar tabela base de treinamentos
CREATE TABLE IF NOT EXISTS public.trainings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  role TEXT NOT NULL,
  description TEXT,
  modules_json JSONB DEFAULT '[]'::jsonb,
  duration INTEGER DEFAULT 0, -- duração em minutos
  certificate_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  active BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_trainings_role ON public.trainings(role);
CREATE INDEX IF NOT EXISTS idx_trainings_active ON public.trainings(active);

COMMENT ON TABLE public.trainings IS 'Treinamentos individuais com módulos e conteúdo';
COMMENT ON COLUMN public.trainings.modules_json IS 'Array JSON com estrutura de módulos, vídeos, textos e quizzes';
COMMENT ON COLUMN public.trainings.duration IS 'Duração estimada em minutos';

-- 2. Criar tabela de progresso individual nos treinamentos
CREATE TABLE IF NOT EXISTS public.training_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  training_id UUID REFERENCES public.trainings(id) ON DELETE CASCADE NOT NULL,
  progress_percent INTEGER DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
  score INTEGER DEFAULT 0,
  status TEXT DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, training_id)
);

CREATE INDEX IF NOT EXISTS idx_training_progress_user ON public.training_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_training_progress_training ON public.training_progress(training_id);
CREATE INDEX IF NOT EXISTS idx_training_progress_status ON public.training_progress(status);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER handle_training_progress_updated_at
  BEFORE UPDATE ON public.training_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.training_progress IS 'Progresso individual de cada colaborador em treinamentos';

-- 3. Criar tabela de trilhas de treinamento (agrupamento por cargo)
CREATE TABLE IF NOT EXISTS public.training_paths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  target_role TEXT NOT NULL, -- 'avaliadora', 'gerente', 'social_midia', 'operador_caixa', 'franqueado', 'suporte'
  icon TEXT DEFAULT '🎓',
  color TEXT DEFAULT '#3b82f6',
  is_active BOOLEAN DEFAULT true,
  order_index INTEGER DEFAULT 0,
  estimated_duration_hours INTEGER DEFAULT 40,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Criar tabela de itens da trilha
CREATE TABLE IF NOT EXISTS public.training_path_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path_id UUID REFERENCES public.training_paths(id) ON DELETE CASCADE,
  training_id UUID REFERENCES public.trainings(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  is_required BOOLEAN DEFAULT true,
  unlock_after UUID REFERENCES public.training_path_items(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(path_id, training_id)
);

-- 5. Criar tabela de progresso do usuário nas trilhas
CREATE TABLE IF NOT EXISTS public.user_training_paths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  path_id UUID REFERENCES public.training_paths(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  progress_percentage INTEGER DEFAULT 0,
  current_item_id UUID REFERENCES public.training_path_items(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, path_id)
);

-- 6. Criar tabela de tarefas práticas
CREATE TABLE IF NOT EXISTS public.training_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_id UUID REFERENCES public.trainings(id) ON DELETE CASCADE,
  module_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  task_type TEXT NOT NULL, -- 'photo', 'document', 'text', 'video'
  instructions TEXT,
  max_file_size_mb INTEGER DEFAULT 10,
  accepted_file_types TEXT[] DEFAULT ARRAY['image/jpeg', 'image/png'],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Criar tabela de submissões de tarefas
CREATE TABLE IF NOT EXISTS public.training_task_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES public.training_tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  training_id UUID REFERENCES public.trainings(id) ON DELETE CASCADE,
  content TEXT,
  file_url TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  feedback TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(task_id, user_id)
);

-- ============================================
-- CONFIGURAR RLS (ROW LEVEL SECURITY)
-- ============================================

-- Habilitar RLS
ALTER TABLE public.trainings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_paths ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_path_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_training_paths ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_task_submissions ENABLE ROW LEVEL SECURITY;

-- RLS: trainings (base)
DROP POLICY IF EXISTS "Users can view active trainings" ON public.trainings;
CREATE POLICY "Users can view active trainings"
  ON public.trainings FOR SELECT
  USING (active = true);

DROP POLICY IF EXISTS "Admins can manage trainings" ON public.trainings;
CREATE POLICY "Admins can manage trainings"
  ON public.trainings FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- RLS: training_progress
DROP POLICY IF EXISTS "Users can view their own training progress" ON public.training_progress;
CREATE POLICY "Users can view their own training progress"
  ON public.training_progress FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own training progress" ON public.training_progress;
CREATE POLICY "Users can insert their own training progress"
  ON public.training_progress FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own training progress" ON public.training_progress;
CREATE POLICY "Users can update their own training progress"
  ON public.training_progress FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all training progress" ON public.training_progress;
CREATE POLICY "Admins can view all training progress"
  ON public.training_progress FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'gestor_setor')
  ));

-- RLS: training_paths
DROP POLICY IF EXISTS "Users can view active training paths" ON public.training_paths;
CREATE POLICY "Users can view active training paths"
  ON public.training_paths FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage training paths" ON public.training_paths;
CREATE POLICY "Admins can manage training paths"
  ON public.training_paths FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- RLS: training_path_items
DROP POLICY IF EXISTS "Users can view path items" ON public.training_path_items;
CREATE POLICY "Users can view path items"
  ON public.training_path_items FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can manage path items" ON public.training_path_items;
CREATE POLICY "Admins can manage path items"
  ON public.training_path_items FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- RLS: user_training_paths
DROP POLICY IF EXISTS "Users can view their own training paths" ON public.user_training_paths;
CREATE POLICY "Users can view their own training paths"
  ON public.user_training_paths FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create their training path records" ON public.user_training_paths;
CREATE POLICY "Users can create their training path records"
  ON public.user_training_paths FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their training path progress" ON public.user_training_paths;
CREATE POLICY "Users can update their training path progress"
  ON public.user_training_paths FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all training paths" ON public.user_training_paths;
CREATE POLICY "Admins can view all training paths"
  ON public.user_training_paths FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- RLS: training_tasks
DROP POLICY IF EXISTS "Users can view training tasks" ON public.training_tasks;
CREATE POLICY "Users can view training tasks"
  ON public.training_tasks FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can manage training tasks" ON public.training_tasks;
CREATE POLICY "Admins can manage training tasks"
  ON public.training_tasks FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- RLS: training_task_submissions
DROP POLICY IF EXISTS "Users can view their own submissions" ON public.training_task_submissions;
CREATE POLICY "Users can view their own submissions"
  ON public.training_task_submissions FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create their own submissions" ON public.training_task_submissions;
CREATE POLICY "Users can create their own submissions"
  ON public.training_task_submissions FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their pending submissions" ON public.training_task_submissions;
CREATE POLICY "Users can update their pending submissions"
  ON public.training_task_submissions FOR UPDATE
  USING (user_id = auth.uid() AND status = 'pending');

DROP POLICY IF EXISTS "Admins can manage all submissions" ON public.training_task_submissions;
CREATE POLICY "Admins can manage all submissions"
  ON public.training_task_submissions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- ============================================
-- CRIAR ÍNDICES PARA PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_training_path_items_path ON public.training_path_items(path_id);
CREATE INDEX IF NOT EXISTS idx_training_path_items_training ON public.training_path_items(training_id);
CREATE INDEX IF NOT EXISTS idx_training_tasks_training ON public.training_tasks(training_id);
CREATE INDEX IF NOT EXISTS idx_training_task_submissions_user ON public.training_task_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_training_task_submissions_task ON public.training_task_submissions(task_id);
CREATE INDEX IF NOT EXISTS idx_user_training_paths_user ON public.user_training_paths(user_id);
CREATE INDEX IF NOT EXISTS idx_user_training_paths_path ON public.user_training_paths(path_id);

-- ============================================
-- CRIAR TRIGGERS PARA UPDATED_AT
-- ============================================

CREATE TRIGGER handle_training_paths_updated_at
  BEFORE UPDATE ON public.training_paths
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_training_tasks_updated_at
  BEFORE UPDATE ON public.training_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_training_task_submissions_updated_at
  BEFORE UPDATE ON public.training_task_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_user_training_paths_updated_at
  BEFORE UPDATE ON public.user_training_paths
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- INSERIR TRILHAS DE EXEMPLO
-- ============================================

INSERT INTO public.training_paths (name, description, target_role, icon, color, order_index, estimated_duration_hours)
VALUES
('Trilha de Avaliadora', 'Programa completo de capacitação para avaliadora com módulos de bioimpedância, avaliação corporal e atendimento ao cliente', 'avaliadora', '👩‍⚕️', '#10b981', 1, 40),
('Trilha de Gerente', 'Desenvolvimento de habilidades gerenciais, liderança de equipe e gestão operacional da unidade', 'gerente', '👔', '#3b82f6', 2, 60),
('Trilha de Social Mídia', 'Estratégias de marketing digital, gestão de redes sociais e criação de conteúdo', 'social_midia', '📱', '#ec4899', 3, 30),
('Trilha de Operador de Caixa', 'Processos operacionais, sistema DFCom, atendimento ao fornecedor e fluxo de caixa', 'operador_caixa', '💰', '#f59e0b', 4, 20),
('Trilha de Franqueado', 'Gestão completa da franquia Cresci e Perdi: operação, finanças, RH e marketing', 'franqueado', '🏢', '#8b5cf6', 5, 80),
('Trilha de Suporte', 'Atendimento técnico, suporte operacional e resolução de problemas', 'suporte', '🎧', '#06b6d4', 6, 35)
ON CONFLICT DO NOTHING;

-- ============================================
-- COMENTÁRIOS PARA DOCUMENTAÇÃO
-- ============================================

COMMENT ON TABLE public.training_paths IS 'Trilhas de treinamento organizadas por cargo';
COMMENT ON TABLE public.training_path_items IS 'Itens (treinamentos) dentro de uma trilha com condições de desbloqueio';
COMMENT ON TABLE public.training_tasks IS 'Tarefas práticas dentro dos módulos de treinamento (foto, documento, etc)';
COMMENT ON TABLE public.training_task_submissions IS 'Submissões de usuários para tarefas práticas';
COMMENT ON TABLE public.user_training_paths IS 'Progresso do usuário nas trilhas de treinamento';

-- ============================================
-- SISTEMA DE QUIZ E AVALIAÇÃO
-- ============================================

-- Tabela para armazenar tentativas de quiz
CREATE TABLE IF NOT EXISTS public.training_quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  training_id UUID REFERENCES public.trainings(id) ON DELETE CASCADE,
  module_id TEXT NOT NULL,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  score INTEGER NOT NULL,
  answers JSONB NOT NULL,
  passed BOOLEAN NOT NULL,
  feedback_used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, training_id, module_id, attempt_number)
);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user ON public.training_quiz_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_training ON public.training_quiz_attempts(training_id);

-- RLS para quiz attempts
ALTER TABLE public.training_quiz_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their quiz attempts" ON public.training_quiz_attempts;
CREATE POLICY "Users can view their quiz attempts"
  ON public.training_quiz_attempts FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create quiz attempts" ON public.training_quiz_attempts;
CREATE POLICY "Users can create quiz attempts"
  ON public.training_quiz_attempts FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all quiz attempts" ON public.training_quiz_attempts;
CREATE POLICY "Admins can view all quiz attempts"
  ON public.training_quiz_attempts FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

COMMENT ON TABLE public.training_quiz_attempts IS 'Registro de tentativas de quiz com pontuação e respostas';
COMMENT ON COLUMN public.training_quiz_attempts.feedback_used IS 'Se o usuário usou feedback da IA nesta tentativa';

-- ============================================
-- FEED AUTOMÁTICO - TRIGGERS E FUNÇÕES
-- ============================================

-- Função para criar post automático no feed
CREATE OR REPLACE FUNCTION public.auto_create_feed_post(
  p_type TEXT,
  p_title TEXT,
  p_description TEXT,
  p_module_link TEXT DEFAULT NULL,
  p_media_url TEXT DEFAULT NULL,
  p_created_by UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  supabase_url TEXT;
  service_key TEXT;
  payload JSONB;
BEGIN
  -- Obter configurações do Supabase
  supabase_url := current_setting('app.settings.supabase_url', true);
  service_key := current_setting('app.settings.service_role_key', true);
  
  IF supabase_url IS NULL OR service_key IS NULL THEN
    RAISE WARNING 'Supabase URL ou Service Key não configurados';
    RETURN;
  END IF;
  
  -- Preparar payload
  payload := jsonb_build_object(
    'type', p_type,
    'title', p_title,
    'description', p_description,
    'module_link', p_module_link,
    'media_url', p_media_url,
    'created_by', p_created_by
  );
  
  -- Chamar edge function via pg_net
  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/auto-feed-post',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := payload
  );
  
  RAISE LOG 'Feed post auto-creation triggered: % - %', p_type, p_title;
END;
$$;

-- Trigger para novos treinamentos
CREATE OR REPLACE FUNCTION public.on_training_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.active = true THEN
    PERFORM auto_create_feed_post(
      'training',
      '🎓 Novo Treinamento: ' || NEW.title,
      COALESCE(NEW.description, 'Acesse agora e desenvolva suas habilidades!'),
      '/treinamentos',
      NULL,
      NULL
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_training_feed_post ON public.trainings;
CREATE TRIGGER trigger_training_feed_post
  AFTER INSERT ON public.trainings
  FOR EACH ROW
  EXECUTE FUNCTION public.on_training_created();

-- Trigger para novos comunicados
CREATE OR REPLACE FUNCTION public.on_announcement_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.published = true THEN
    PERFORM auto_create_feed_post(
      'announcement',
      '📢 ' || NEW.title,
      COALESCE(NEW.content, ''),
      '/comunicados',
      NEW.image_url,
      NEW.author_id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_announcement_feed_post ON public.announcements;
CREATE TRIGGER trigger_announcement_feed_post
  AFTER INSERT ON public.announcements
  FOR EACH ROW
  EXECUTE FUNCTION public.on_announcement_created();

-- Trigger para reconhecimentos
CREATE OR REPLACE FUNCTION public.on_recognition_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipient_name TEXT;
BEGIN
  -- Buscar nome do colaborador reconhecido
  SELECT full_name INTO recipient_name
  FROM profiles
  WHERE id = NEW.user_id;
  
  PERFORM auto_create_feed_post(
    'recognition',
    '🏆 Reconhecimento: ' || COALESCE(recipient_name, 'Colaborador'),
    NEW.message,
    '/reconhecimento',
    NEW.badge_icon,
    NEW.created_by
  );
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_recognition_feed_post ON public.recognitions;
CREATE TRIGGER trigger_recognition_feed_post
  AFTER INSERT ON public.recognitions
  FOR EACH ROW
  EXECUTE FUNCTION public.on_recognition_created();

-- Trigger para campanhas
CREATE OR REPLACE FUNCTION public.on_campaign_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.active = true THEN
    PERFORM auto_create_feed_post(
      'campaign',
      '🎯 Nova Campanha: ' || NEW.title,
      COALESCE(NEW.description, 'Confira os detalhes e participe!'),
      '/campanhas',
      NEW.banner_url,
      NULL
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_campaign_feed_post ON public.campaigns;
CREATE TRIGGER trigger_campaign_feed_post
  AFTER INSERT ON public.campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.on_campaign_created();

-- Trigger para ideias aprovadas
CREATE OR REPLACE FUNCTION public.on_idea_approved()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  author_name TEXT;
BEGIN
  IF NEW.status = 'implemented' AND OLD.status != 'implemented' THEN
    -- Buscar nome do autor
    SELECT full_name INTO author_name
    FROM profiles
    WHERE id = NEW.user_id;
    
    PERFORM auto_create_feed_post(
      'idea',
      '💡 Ideia Implementada: ' || NEW.title,
      'Sugestão de ' || COALESCE(author_name, 'colaborador') || ' foi aprovada e implementada!',
      '/ideias',
      NULL,
      NEW.user_id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_idea_approved_feed_post ON public.ideas;
CREATE TRIGGER trigger_idea_approved_feed_post
  AFTER UPDATE ON public.ideas
  FOR EACH ROW
  EXECUTE FUNCTION public.on_idea_approved();

-- Trigger para novos manuais
CREATE OR REPLACE FUNCTION public.on_manual_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.published = true THEN
    PERFORM auto_create_feed_post(
      'manual',
      '📚 Novo Manual: ' || NEW.title,
      COALESCE(NEW.description, 'Acesse para consultar procedimentos e diretrizes.'),
      '/manuais',
      NEW.cover_url,
      NEW.created_by
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_manual_feed_post ON public.manuals;
CREATE TRIGGER trigger_manual_feed_post
  AFTER INSERT ON public.manuals
  FOR EACH ROW
  EXECUTE FUNCTION public.on_manual_created();

-- Trigger para checklists importantes
CREATE OR REPLACE FUNCTION public.on_checklist_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só criar post se for checklist de alta prioridade
  IF NEW.active = true AND NEW.importance = 'high' THEN
    PERFORM auto_create_feed_post(
      'checklist',
      '✅ Novo Checklist: ' || NEW.title,
      COALESCE(NEW.description, 'Checklist de alta prioridade disponível.'),
      '/checklists',
      NULL,
      NULL
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_checklist_feed_post ON public.checklists;
CREATE TRIGGER trigger_checklist_feed_post
  AFTER INSERT ON public.checklists
  FOR EACH ROW
  EXECUTE FUNCTION public.on_checklist_created();

-- Trigger para mídias importantes
CREATE OR REPLACE FUNCTION public.on_media_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só criar post se for marcado como featured
  IF NEW.featured = true THEN
    PERFORM auto_create_feed_post(
      'media',
      '🎬 Nova Mídia: ' || NEW.title,
      COALESCE(NEW.description, 'Novo conteúdo visual disponível.'),
      '/midias',
      NEW.thumbnail_url,
      NEW.uploaded_by
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_media_feed_post ON public.media_library;
CREATE TRIGGER trigger_media_feed_post
  AFTER INSERT ON public.media_library
  FOR EACH ROW
  EXECUTE FUNCTION public.on_media_created();

-- Trigger para pesquisas
CREATE OR REPLACE FUNCTION public.on_survey_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.active = true THEN
    PERFORM auto_create_feed_post(
      'survey',
      '📊 Nova Pesquisa: ' || NEW.title,
      COALESCE(NEW.description, 'Participe e compartilhe sua opinião!'),
      '/pesquisas',
      NULL,
      NEW.created_by
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_survey_feed_post ON public.surveys;
CREATE TRIGGER trigger_survey_feed_post
  AFTER INSERT ON public.surveys
  FOR EACH ROW
  EXECUTE FUNCTION public.on_survey_created();

COMMENT ON FUNCTION public.auto_create_feed_post IS 'Cria automaticamente posts no feed via edge function';
COMMENT ON FUNCTION public.on_training_created IS 'Trigger para criar post quando novo treinamento é adicionado';
COMMENT ON FUNCTION public.on_announcement_created IS 'Trigger para criar post quando comunicado é publicado';
COMMENT ON FUNCTION public.on_recognition_created IS 'Trigger para criar post quando reconhecimento é dado';
COMMENT ON FUNCTION public.on_campaign_created IS 'Trigger para criar post quando campanha é lançada';
COMMENT ON FUNCTION public.on_idea_approved IS 'Trigger para criar post quando ideia é aprovada';
COMMENT ON FUNCTION public.on_manual_created IS 'Trigger para criar post quando manual é publicado';
COMMENT ON FUNCTION public.on_checklist_created IS 'Trigger para criar post de checklists importantes';
COMMENT ON FUNCTION public.on_media_created IS 'Trigger para criar post de mídias em destaque';
COMMENT ON FUNCTION public.on_survey_created IS 'Trigger para criar post quando pesquisa é lançada';

-- ============================================
-- SISTEMA DE REAÇÕES E INTERAÇÕES SOCIAIS
-- ============================================

-- Criar tabela feed_posts (se não existir)
CREATE TABLE IF NOT EXISTS public.feed_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('training', 'checklist', 'manual', 'campaign', 'recognition', 'idea', 'media', 'survey', 'announcement')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  module_link TEXT,
  media_url TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  pinned BOOLEAN DEFAULT false,
  likes_count INTEGER DEFAULT 0,
  love_count INTEGER DEFAULT 0,
  fire_count INTEGER DEFAULT 0,
  clap_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Criar tabela de likes/reações
CREATE TABLE IF NOT EXISTS public.feed_post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.feed_posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  reaction_type TEXT DEFAULT 'like' CHECK (reaction_type IN ('like', 'love', 'fire', 'clap')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(post_id, user_id)
);

-- Criar tabela de comentários
CREATE TABLE IF NOT EXISTS public.feed_post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.feed_posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  comment TEXT NOT NULL CHECK (LENGTH(comment) <= 140),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_feed_posts_type ON public.feed_posts(type);
CREATE INDEX IF NOT EXISTS idx_feed_posts_created_at ON public.feed_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_post_likes_post ON public.feed_post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_feed_post_likes_user ON public.feed_post_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_feed_post_comments_post ON public.feed_post_comments(post_id);

-- RLS
ALTER TABLE public.feed_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_post_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view feed posts" ON public.feed_posts;
CREATE POLICY "Anyone can view feed posts" ON public.feed_posts FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage their own likes" ON public.feed_post_likes;
CREATE POLICY "Users can manage their own likes" ON public.feed_post_likes FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create comments" ON public.feed_post_comments;
CREATE POLICY "Users can create comments" ON public.feed_post_comments FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- ============================================
-- ONBOARDING AUTOMÁTICO
-- ============================================

-- Habilitar extensão pg_net para chamadas HTTP
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Função para chamar edge function de onboarding
CREATE OR REPLACE FUNCTION public.handle_new_user_training_onboarding()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  function_url TEXT;
  payload JSONB;
  supabase_url TEXT;
  service_key TEXT;
BEGIN
  -- Obter configurações
  supabase_url := current_setting('app.settings.supabase_url', true);
  service_key := current_setting('app.settings.service_role_key', true);
  
  -- Se não estiver configurado, não executar
  IF supabase_url IS NULL OR service_key IS NULL THEN
    RAISE WARNING 'Supabase URL ou Service Key não configurados para onboarding automático';
    RETURN NEW;
  END IF;
  
  -- Construir URL da edge function
  function_url := supabase_url || '/functions/v1/auto-assign-training-path';
  
  -- Preparar payload
  payload := jsonb_build_object(
    'user_id', NEW.id,
    'role', NEW.role,
    'full_name', NEW.full_name,
    'phone', NEW.phone
  );
  
  -- Chamar edge function de forma assíncrona
  PERFORM net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := payload
  );
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't block user creation
    RAISE WARNING 'Error in training onboarding trigger: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Trigger para novos usuários
DROP TRIGGER IF EXISTS on_new_user_training_onboarding ON public.profiles;
CREATE TRIGGER on_new_user_training_onboarding
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_training_onboarding();

-- Inserir configurações de onboarding
INSERT INTO public.settings (key, value, description)
VALUES 
  ('onboarding_auto_assign', 'false', 'Habilitar atribuição automática de trilhas no onboarding'),
  ('default_training_by_role', '{}', 'Mapeamento de cargo para ID de trilha de treinamento (JSON)')
ON CONFLICT (key) DO UPDATE
SET description = EXCLUDED.description;

-- ============================================
-- STORAGE BUCKET PARA CERTIFICADOS
-- ============================================

-- Criar bucket para certificados (público)
INSERT INTO storage.buckets (id, name, public)
VALUES ('training-certificates', 'training-certificates', true)
ON CONFLICT (id) DO NOTHING;

-- RLS para o bucket de certificados
CREATE POLICY "Users can view their own certificates"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'training-certificates' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "System can upload certificates"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'training-certificates'
  AND auth.role() = 'service_role'
);

-- ============================================
-- TABELA DE CERTIFICADOS
-- ============================================

CREATE TABLE IF NOT EXISTS public.training_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  training_id UUID REFERENCES public.trainings(id) ON DELETE CASCADE,
  training_path_id UUID REFERENCES public.training_paths(id) ON DELETE CASCADE,
  issued_at TIMESTAMPTZ DEFAULT now(),
  pdf_url TEXT NOT NULL,
  verified BOOLEAN DEFAULT false,
  validation_url TEXT NOT NULL,
  score INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_certificates_user ON public.training_certificates(user_id);
CREATE INDEX IF NOT EXISTS idx_certificates_training ON public.training_certificates(training_id);
CREATE INDEX IF NOT EXISTS idx_certificates_path ON public.training_certificates(training_path_id);

-- RLS para certificados
ALTER TABLE public.training_certificates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their certificates" ON public.training_certificates;
CREATE POLICY "Users can view their certificates"
  ON public.training_certificates FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all certificates" ON public.training_certificates;
CREATE POLICY "Admins can view all certificates"
  ON public.training_certificates FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

DROP POLICY IF EXISTS "System can create certificates" ON public.training_certificates;
CREATE POLICY "System can create certificates"
  ON public.training_certificates FOR INSERT
  WITH CHECK (true);

COMMENT ON TABLE public.training_certificates IS 'Certificados de conclusão de treinamentos e trilhas';
COMMENT ON COLUMN public.training_certificates.pdf_url IS 'URL do arquivo PDF do certificado no storage';
COMMENT ON COLUMN public.training_certificates.verified IS 'Indica se o certificado foi validado via QR Code';
COMMENT ON COLUMN public.training_certificates.validation_url IS 'URL pública para validação do certificado via QR Code';

-- ============================================
-- FEEDBACK PÓS-TREINAMENTO
-- ============================================

CREATE TABLE IF NOT EXISTS public.training_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  training_path_id UUID REFERENCES public.training_paths(id) ON DELETE CASCADE NOT NULL,
  was_clear INTEGER NOT NULL CHECK (was_clear BETWEEN 1 AND 5),
  feels_prepared INTEGER NOT NULL CHECK (feels_prepared BETWEEN 1 AND 5),
  additional_comments TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_training_feedback_user ON public.training_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_training_feedback_path ON public.training_feedback(training_path_id);
CREATE INDEX IF NOT EXISTS idx_training_feedback_created ON public.training_feedback(created_at);

-- RLS para feedback
ALTER TABLE public.training_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert their own feedback" ON public.training_feedback;
CREATE POLICY "Users can insert their own feedback"
  ON public.training_feedback FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view their own feedback" ON public.training_feedback;
CREATE POLICY "Users can view their own feedback"
  ON public.training_feedback FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all feedback" ON public.training_feedback;
CREATE POLICY "Admins can view all feedback"
  ON public.training_feedback FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'gestor_setor')
  ));

DROP POLICY IF EXISTS "Managers can view all feedback" ON public.training_feedback;
CREATE POLICY "Managers can view all feedback"
  ON public.training_feedback FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'gestor_setor'
  ));

COMMENT ON TABLE public.training_feedback IS 'Feedback dos colaboradores após conclusão de treinamentos';
COMMENT ON COLUMN public.training_feedback.was_clear IS 'Avaliação de clareza do treinamento (1-5)';
COMMENT ON COLUMN public.training_feedback.feels_prepared IS 'Avaliação de preparação para executar função (1-5)';

-- ============================================
-- GATILHOS E AUTOMAÇÕES
-- ============================================

-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Configurar cron job para verificar usuários inativos (executa diariamente às 9h)
SELECT cron.schedule(
  'check-inactive-training-users',
  '0 9 * * *',
  $$
  SELECT
    net.http_post(
      url:='YOUR_SUPABASE_URL/functions/v1/check-inactive-users',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
      body:=concat('{"triggered_at": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);

COMMENT ON TABLE public.training_feedback IS 'Configurar URL e chave do Supabase no cron job acima';

-- ============================================
-- CONFIGURAÇÕES DE INTEGRAÇÃO
-- ============================================

-- Adicionar configurações para integrações
INSERT INTO public.settings (key, value, description)
VALUES 
  ('auto_certificate_generation', 'true', 'Gerar certificado automaticamente ao completar trilha'),
  ('notify_managers_on_completion', 'true', 'Notificar gerentes quando colaborador completa trilha'),
  ('send_quiz_failure_help', 'true', 'Enviar explicação com IA quando colaborador reprova no quiz'),
  ('inactive_user_alert_days', '30', 'Dias sem progresso para enviar alerta'),
  ('zapi_instance_id', '', 'ID da instância Z-API para notificações WhatsApp'),
  ('zapi_notifications_enabled', 'false', 'Habilitar notificações via WhatsApp (Z-API)')
ON CONFLICT (key) DO UPDATE
SET description = EXCLUDED.description;
```

## Configuração dos Cron Jobs

1. Acesse o **Supabase Dashboard**
2. Navegue até **SQL Editor**
3. Copie e cole todo o SQL acima
4. Execute o script
5. **IMPORTANTE:** Configure as variáveis de ambiente executando:
   ```sql
   ALTER DATABASE postgres SET app.settings.supabase_url = 'https://sgeabunxaunzoedwvvox.supabase.co';
   ALTER DATABASE postgres SET app.settings.service_role_key = 'SEU_SERVICE_ROLE_KEY_AQUI';
   SELECT pg_reload_conf();
   ```
   ⚠️ Substitua `SEU_SERVICE_ROLE_KEY_AQUI` pela sua chave real do Supabase
6. Volte para a Intranet e acesse **Admin > Cross Config > Onboarding** para configurar as trilhas por cargo
7. Acesse **/minha-jornada** para ver suas trilhas

## Recursos Implementados

✅ **Jornadas de Treinamento por Cargo**
- Trilhas personalizadas para: Avaliadora, Gerente, Social Mídia, Operador de Caixa, Franqueado, Suporte

✅ **Sistema de Checkpoints**
- Desbloqueio condicional de módulos
- Progresso visual em cada trilha

✅ **Tarefas Práticas** (estrutura pronta)
- Envio de fotos
- Upload de documentos
- Tarefas de texto
- Vídeos

✅ **Certificação Automática**
- Integrado com o sistema existente de certificados

✅ **Onboarding Automático**
- Trigger que associa trilhas automaticamente ao criar novos usuários
- Notificações via WhatsApp e push interno
- Configuração de mapeamento cargo → trilha

## Configuração do Onboarding Automático

Após executar o SQL:

1. Acesse **Admin > Cross Config > Onboarding**
2. Habilite "Ativar Onboarding Automático"
3. Configure o mapeamento de cargos para trilhas:
   - Cada cargo pode ter uma trilha padrão
   - Ao criar um usuário com aquele cargo, a trilha será atribuída automaticamente
4. O sistema enviará notificações automáticas de boas-vindas

## Próximos Passos

1. Vincular treinamentos existentes às trilhas
2. Configurar sequência e dependências
3. Adicionar tarefas práticas aos módulos
4. Testar fluxo completo de onboarding
