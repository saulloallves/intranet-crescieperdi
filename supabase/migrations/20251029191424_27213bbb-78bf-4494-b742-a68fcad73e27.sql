-- Corrigir search_path nas funções do CrossConfig

-- Função: Criar Snapshot
CREATE OR REPLACE FUNCTION public.create_crossconfig_snapshot(
  p_version_tag TEXT,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_snapshot_id UUID;
  v_data JSONB;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Apenas administradores podem criar snapshots';
  END IF;

  SELECT jsonb_object_agg(
    category || '.' || param,
    value
  ) INTO v_data
  FROM public.crossconfig_settings;

  INSERT INTO public.crossconfig_versions (
    version_tag,
    data_snapshot,
    created_by,
    description
  ) VALUES (
    p_version_tag,
    v_data,
    auth.uid(),
    p_description
  )
  RETURNING id INTO v_snapshot_id;

  RETURN v_snapshot_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Função: Restaurar Snapshot
CREATE OR REPLACE FUNCTION public.restore_crossconfig_snapshot(
  p_version_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_snapshot JSONB;
  v_key TEXT;
  v_category TEXT;
  v_param TEXT;
  v_value JSONB;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Apenas administradores podem restaurar snapshots';
  END IF;

  SELECT data_snapshot INTO v_snapshot
  FROM public.crossconfig_versions
  WHERE id = p_version_id;

  IF v_snapshot IS NULL THEN
    RAISE EXCEPTION 'Snapshot não encontrado';
  END IF;

  FOR v_key, v_value IN SELECT * FROM jsonb_each(v_snapshot)
  LOOP
    v_category := split_part(v_key, '.', 1);
    v_param := split_part(v_key, '.', 2);
    
    UPDATE public.crossconfig_settings
    SET value = v_value,
        updated_by = auth.uid(),
        updated_at = now()
    WHERE category = v_category AND param = v_param;
  END LOOP;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;