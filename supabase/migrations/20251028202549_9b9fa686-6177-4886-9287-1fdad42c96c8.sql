-- Corrigir função index_feed_post() adicionando SET search_path para segurança
CREATE OR REPLACE FUNCTION index_feed_post()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só indexar posts importantes (pinados ou de tipos específicos)
  IF NEW.pinned = true OR NEW.type IN ('announcement', 'training', 'manual', 'campaign') THEN
    
    -- Log para debug
    RAISE LOG 'Auto-indexing feed post: % - %', NEW.type, NEW.title;
    
    -- Inserir diretamente no search_index
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
      embedding = NULL;
    
    RAISE LOG 'Feed post indexed successfully';
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to auto-index feed post: %', SQLERRM;
    RETURN NEW;
END;
$$;