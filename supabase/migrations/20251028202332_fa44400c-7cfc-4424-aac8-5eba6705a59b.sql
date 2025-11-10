-- Corrigir search_path da função index_feed_post
CREATE OR REPLACE FUNCTION index_feed_post()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Só indexar posts importantes (pinados ou de tipos específicos)
  IF NEW.pinned = true OR NEW.type IN ('announcement', 'training', 'manual', 'campaign') THEN
    
    -- Log para debug
    RAISE LOG 'Auto-indexing feed post: % - %', NEW.type, NEW.title;
    
    -- Inserir diretamente no search_index para evitar dependência de HTTP
    -- (mais confiável que chamar edge function)
    INSERT INTO search_index (
      content_type,
      content_id,
      title,
      content,
      metadata,
      updated_at
    )
    VALUES (
      'feed_post',
      NEW.id,
      SUBSTRING(NEW.title, 1, 200),
      NEW.title || ' ' || COALESCE(NEW.description, ''),
      jsonb_build_object(
        'post_type', NEW.type,
        'audience_roles', COALESCE(NEW.audience_roles, '{}'),
        'audience_units', COALESCE(NEW.audience_units, '{}'),
        'pinned', NEW.pinned
      ),
      now()
    )
    ON CONFLICT (content_id, content_type) 
    DO UPDATE SET
      title = EXCLUDED.title,
      content = EXCLUDED.content,
      metadata = EXCLUDED.metadata,
      updated_at = now(),
      embedding = NULL; -- Força reindexação do embedding
    
    RAISE LOG 'Feed post indexed successfully';
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Não falhar a operação principal se houver erro ao indexar
    RAISE WARNING 'Failed to auto-index feed post: %', SQLERRM;
    RETURN NEW;
END;
$$;