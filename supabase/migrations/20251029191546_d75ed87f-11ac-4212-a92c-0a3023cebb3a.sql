-- Corrigir search_path das funções do crossconfig

-- 1. update_crossconfig_updated_at
CREATE OR REPLACE FUNCTION public.update_crossconfig_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. log_crossconfig_changes
CREATE OR REPLACE FUNCTION public.log_crossconfig_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.crossconfig_logs (
    user_id,
    module,
    param,
    old_value,
    new_value,
    rollback_available
  ) VALUES (
    auth.uid(),
    NEW.category,
    NEW.param,
    OLD.value,
    NEW.value,
    true
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. create_crossconfig_snapshot
CREATE OR REPLACE FUNCTION public.create_crossconfig_snapshot(
  p_version_tag TEXT,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_snapshot_id UUID;
  v_data JSONB;
BEGIN
  -- Verificar se usuário é admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Apenas administradores podem criar snapshots';
  END IF;

  -- Criar snapshot de todas as configurações
  SELECT jsonb_object_agg(
    category || '.' || param,
    value
  ) INTO v_data
  FROM public.crossconfig_settings;

  -- Inserir versão
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

-- 4. restore_crossconfig_snapshot
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
  -- Verificar se usuário é admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Apenas administradores podem restaurar snapshots';
  END IF;

  -- Buscar snapshot
  SELECT data_snapshot INTO v_snapshot
  FROM public.crossconfig_versions
  WHERE id = p_version_id;

  IF v_snapshot IS NULL THEN
    RAISE EXCEPTION 'Snapshot não encontrado';
  END IF;

  -- Restaurar cada configuração
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