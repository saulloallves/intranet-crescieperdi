-- =====================================================================================
-- MIGRATION: Correção de Nomes de Colunas nos Triggers do Feed
-- =====================================================================================
-- Description: Corrige os nomes das colunas audience_roles e audience_units
-- na função auto_create_feed_post_trigger para corresponder à estrutura real
-- =====================================================================================

-- Recriar a função com os nomes corretos das colunas
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
  
  -- Criar post diretamente na tabela feed_posts com os nomes corretos das colunas
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

COMMENT ON FUNCTION public.auto_create_feed_post_trigger IS 'Cria automaticamente posts no feed quando novos conteúdos são publicados nos módulos (CORRIGIDO)';

