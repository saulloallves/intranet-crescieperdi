-- Corrigir função generate_idea_code para security
CREATE OR REPLACE FUNCTION generate_idea_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.code IS NULL THEN
    NEW.code := 'IDEA-' || 
                EXTRACT(YEAR FROM NEW.created_at)::TEXT || '-' || 
                LPAD((SELECT COUNT(*) + 1 FROM ideas WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NEW.created_at))::TEXT, 3, '0');
  END IF;
  RETURN NEW;
END;
$$;