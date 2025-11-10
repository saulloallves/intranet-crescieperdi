-- =====================================================================================
-- MIGRATION: Feed Auto-Post Triggers
-- =====================================================================================
-- Description: Implementa triggers automáticos para criar posts no feed quando novos
-- conteúdos são publicados nos módulos (treinamentos, campanhas, comunicados, etc.)
-- =====================================================================================

-- Função para criar post automático no feed (chamada via trigger)
-- Esta função insere diretamente na tabela feed_posts quando novos conteúdos são criados
CREATE OR REPLACE FUNCTION public.auto_create_feed_post_trigger(
  p_type TEXT,
  p_title TEXT,
  p_description TEXT,
  p_module_link TEXT DEFAULT NULL,
  p_media_url TEXT DEFAULT NULL,
  p_created_by UUID DEFAULT NULL,
  p_audience_roles user_role[] DEFAULT NULL,
  p_audience_units TEXT[] DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar se o auto-publish está habilitado
  DECLARE
    auto_publish_enabled BOOLEAN;
  BEGIN
    SELECT (value->>'enabled')::boolean INTO auto_publish_enabled
    FROM automation_settings
    WHERE key = 'feed_auto_publish';
    
    IF auto_publish_enabled IS NULL OR auto_publish_enabled = false THEN
      RAISE LOG 'Feed auto-publish disabled, skipping post creation';
      RETURN;
    END IF;
  END;
  
  -- Criar post diretamente na tabela feed_posts
  INSERT INTO feed_posts (
    type,
    title,
    description,
    module_link,
    media_url,
    created_by,
    audience_roles,
    audience_units,
    pinned
  ) VALUES (
    p_type,
    p_title,
    p_description,
    p_module_link,
    p_media_url,
    p_created_by,
    p_audience_roles,
    p_audience_units,
    false
  );
  
  RAISE LOG 'Feed post auto-created: % - %', p_type, p_title;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Não falhar a operação principal se houver erro ao criar post
    RAISE WARNING 'Failed to auto-create feed post: %', SQLERRM;
END;
$$;

-- =====================================================================================
-- TRIGGER 1: Novos Treinamentos
-- =====================================================================================
CREATE OR REPLACE FUNCTION public.on_training_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só criar post se o treinamento estiver publicado E for novo ou mudou de não publicado para publicado
  IF NEW.is_published = true AND (TG_OP = 'INSERT' OR OLD.is_published = false) THEN
    PERFORM auto_create_feed_post_trigger(
      'training',
      '🎓 Novo Treinamento: ' || NEW.title,
      COALESCE(NEW.description, 'Acesse agora e desenvolva suas habilidades!'),
      '/treinamentos',
      NEW.video_url,
      NULL,
      NEW.target_roles::user_role[],
      NULL
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_training_feed_post ON public.trainings;
CREATE TRIGGER trigger_training_feed_post
  AFTER INSERT OR UPDATE OF is_published ON public.trainings
  FOR EACH ROW
  WHEN (NEW.is_published = true)
  EXECUTE FUNCTION public.on_training_created();

-- =====================================================================================
-- TRIGGER 2: Novos Comunicados
-- =====================================================================================
CREATE OR REPLACE FUNCTION public.on_announcement_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_published = true AND (TG_OP = 'INSERT' OR OLD.is_published = false) THEN
    PERFORM auto_create_feed_post_trigger(
      'announcement',
      '📢 ' || NEW.title,
      COALESCE(NEW.content, ''),
      '/comunicados',
      NEW.media_url,
      NEW.author_id,
      NEW.target_roles::user_role[],
      NEW.target_units
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_announcement_feed_post ON public.announcements;
CREATE TRIGGER trigger_announcement_feed_post
  AFTER INSERT OR UPDATE OF is_published ON public.announcements
  FOR EACH ROW
  WHEN (NEW.is_published = true)
  EXECUTE FUNCTION public.on_announcement_created();

-- =====================================================================================
-- TRIGGER 3: Novos Reconhecimentos
-- =====================================================================================
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
  
  PERFORM auto_create_feed_post_trigger(
    'recognition',
    '🏆 Reconhecimento: ' || COALESCE(recipient_name, 'Colaborador Destaque'),
    NEW.description,
    '/reconhecimento',
    NULL,
    NULL,
    NULL,
    NULL
  );
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_recognition_feed_post ON public.recognitions;
CREATE TRIGGER trigger_recognition_feed_post
  AFTER INSERT ON public.recognitions
  FOR EACH ROW
  EXECUTE FUNCTION public.on_recognition_created();

-- =====================================================================================
-- TRIGGER 4: Novas Campanhas
-- =====================================================================================
CREATE OR REPLACE FUNCTION public.on_campaign_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_active = true AND (TG_OP = 'INSERT' OR OLD.is_active = false) THEN
    PERFORM auto_create_feed_post_trigger(
      'campaign',
      '🎯 Nova Campanha: ' || NEW.title,
      COALESCE(NEW.description, 'Confira os detalhes e participe!'),
      '/campanhas',
      NULL,
      NULL,
      NEW.target_roles::user_role[],
      NEW.target_units
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_campaign_feed_post ON public.campaigns;
CREATE TRIGGER trigger_campaign_feed_post
  AFTER INSERT OR UPDATE OF is_active ON public.campaigns
  FOR EACH ROW
  WHEN (NEW.is_active = true)
  EXECUTE FUNCTION public.on_campaign_created();

-- =====================================================================================
-- TRIGGER 5: Novos Manuais (Knowledge Base)
-- =====================================================================================
CREATE OR REPLACE FUNCTION public.on_manual_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_published = true AND (TG_OP = 'INSERT' OR OLD.is_published = false) THEN
    PERFORM auto_create_feed_post_trigger(
      'manual',
      '📚 Novo Manual: ' || NEW.title,
      COALESCE(substring(NEW.content, 1, 150), 'Guia prático agora disponível!'),
      '/manuais',
      NEW.file_url,
      NULL,
      NULL,
      NULL
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_manual_feed_post ON public.knowledge_base;
CREATE TRIGGER trigger_manual_feed_post
  AFTER INSERT OR UPDATE OF is_published ON public.knowledge_base
  FOR EACH ROW
  WHEN (NEW.is_published = true)
  EXECUTE FUNCTION public.on_manual_created();

-- =====================================================================================
-- TRIGGER 6: Checklists Ativos
-- =====================================================================================
CREATE OR REPLACE FUNCTION public.on_checklist_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Criar post quando checklist for ativado
  IF NEW.is_active = true AND (TG_OP = 'INSERT' OR OLD.is_active = false) THEN
    PERFORM auto_create_feed_post_trigger(
      'checklist',
      '✅ Novo Checklist: ' || NEW.title,
      COALESCE(NEW.description, 'Novo checklist disponível. Confira!'),
      '/checklists',
      NULL,
      NULL,
      NULL,
      NULL
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_checklist_feed_post ON public.checklists;
CREATE TRIGGER trigger_checklist_feed_post
  AFTER INSERT OR UPDATE OF is_active ON public.checklists
  FOR EACH ROW
  WHEN (NEW.is_active = true)
  EXECUTE FUNCTION public.on_checklist_created();

-- =====================================================================================
-- TRIGGER 7: Solicitações de Mídia Concluídas
-- =====================================================================================
-- Nota: A tabela media_library não existe, mas temos media_requests
-- Vamos criar trigger para quando uma solicitação for completada
CREATE OR REPLACE FUNCTION public.on_media_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Criar post quando mídia for completada
  IF NEW.status = 'completed' AND (TG_OP = 'INSERT' OR OLD.status != 'completed') THEN
    PERFORM auto_create_feed_post_trigger(
      'media',
      '🎬 Nova Mídia: ' || NEW.title,
      COALESCE(NEW.description, 'Novo conteúdo visual disponível.'),
      '/midias',
      NULL,
      NULL,
      NULL,
      NULL
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_media_feed_post ON public.media_requests;
CREATE TRIGGER trigger_media_feed_post
  AFTER INSERT OR UPDATE OF status ON public.media_requests
  FOR EACH ROW
  WHEN (NEW.status = 'completed')
  EXECUTE FUNCTION public.on_media_completed();

-- =====================================================================================
-- TRIGGER 8: Novas Pesquisas
-- =====================================================================================
CREATE OR REPLACE FUNCTION public.on_survey_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_active = true AND (TG_OP = 'INSERT' OR OLD.is_active = false) THEN
    PERFORM auto_create_feed_post_trigger(
      'survey',
      '📊 Nova Pesquisa: ' || NEW.title,
      COALESCE(NEW.description, 'Participe e compartilhe sua opinião!'),
      '/pesquisas',
      NULL,
      NEW.created_by,
      NULL,
      NULL
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_survey_feed_post ON public.surveys;
CREATE TRIGGER trigger_survey_feed_post
  AFTER INSERT OR UPDATE OF is_active ON public.surveys
  FOR EACH ROW
  WHEN (NEW.is_active = true)
  EXECUTE FUNCTION public.on_survey_created();

-- =====================================================================================
-- TRIGGER 9: Ideias Aprovadas
-- =====================================================================================
CREATE OR REPLACE FUNCTION public.on_idea_approved()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  author_name TEXT;
BEGIN
  -- Só criar post quando ideia for aprovada
  IF NEW.status = 'implemented' AND (TG_OP = 'INSERT' OR OLD.status != 'implemented') THEN
    SELECT full_name INTO author_name
    FROM profiles
    WHERE id = NEW.author_id;
    
    PERFORM auto_create_feed_post_trigger(
      'idea',
      '💡 Ideia Implementada: ' || NEW.title,
      'Ideia de ' || COALESCE(author_name, 'colaborador') || ' foi colocada em prática! ' || COALESCE(NEW.description, ''),
      '/ideias',
      NULL,
      NULL,
      NULL,
      NULL
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_idea_feed_post ON public.ideas;
CREATE TRIGGER trigger_idea_feed_post
  AFTER INSERT OR UPDATE OF status ON public.ideas
  FOR EACH ROW
  WHEN (NEW.status = 'implemented')
  EXECUTE FUNCTION public.on_idea_approved();

-- =====================================================================================
-- Comentários e documentação
-- =====================================================================================
COMMENT ON FUNCTION public.auto_create_feed_post_trigger IS 'Cria automaticamente posts no feed quando novos conteúdos são publicados nos módulos';
COMMENT ON FUNCTION public.on_training_created IS 'Trigger para criar post no feed quando novo treinamento é ativado';
COMMENT ON FUNCTION public.on_announcement_created IS 'Trigger para criar post no feed quando novo comunicado é publicado';
COMMENT ON FUNCTION public.on_recognition_created IS 'Trigger para criar post no feed quando novo reconhecimento é criado';
COMMENT ON FUNCTION public.on_campaign_created IS 'Trigger para criar post no feed quando nova campanha é ativada';
COMMENT ON FUNCTION public.on_manual_created IS 'Trigger para criar post no feed quando novo manual é publicado';
COMMENT ON FUNCTION public.on_checklist_created IS 'Trigger para criar post no feed quando checklist é ativado';
COMMENT ON FUNCTION public.on_media_completed IS 'Trigger para criar post no feed quando solicitação de mídia é completada';
COMMENT ON FUNCTION public.on_survey_created IS 'Trigger para criar post no feed quando nova pesquisa é ativada';
COMMENT ON FUNCTION public.on_idea_approved IS 'Trigger para criar post no feed quando ideia é aprovada/implementada';

