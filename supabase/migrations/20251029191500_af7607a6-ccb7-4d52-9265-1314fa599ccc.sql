-- ============================================
-- CROSSCONFIG: Sistema de Configuração Global
-- ============================================

-- 1. Tabela principal de configurações globais
CREATE TABLE IF NOT EXISTS public.crossconfig_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK (category IN ('ia', 'seguranca', 'integracoes', 'modulos', 'rotinas', 'metricas', 'usuarios', 'mural', 'onboarding', 'branding')),
  param TEXT NOT NULL,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  editable BOOLEAN DEFAULT true,
  UNIQUE(category, param)
);

-- 2. Tabela de logs de auditoria
CREATE TABLE IF NOT EXISTS public.crossconfig_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  module TEXT NOT NULL,
  param TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  timestamp TIMESTAMPTZ DEFAULT now(),
  rollback_available BOOLEAN DEFAULT true
);

-- 3. Tabela de versionamento
CREATE TABLE IF NOT EXISTS public.crossconfig_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_tag TEXT NOT NULL UNIQUE,
  data_snapshot JSONB NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  description TEXT
);

-- ============================================
-- TRIGGERS
-- ============================================

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_crossconfig_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS update_crossconfig_settings_updated_at ON public.crossconfig_settings;
CREATE TRIGGER update_crossconfig_settings_updated_at
  BEFORE UPDATE ON public.crossconfig_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_crossconfig_updated_at();

-- Trigger para criar log de auditoria
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS log_crossconfig_settings_changes ON public.crossconfig_settings;
CREATE TRIGGER log_crossconfig_settings_changes
  AFTER UPDATE ON public.crossconfig_settings
  FOR EACH ROW
  WHEN (OLD.value IS DISTINCT FROM NEW.value)
  EXECUTE FUNCTION public.log_crossconfig_changes();

-- ============================================
-- RLS POLICIES
-- ============================================

-- Habilitar RLS
ALTER TABLE public.crossconfig_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crossconfig_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crossconfig_versions ENABLE ROW LEVEL SECURITY;

-- Drop policies se existirem
DROP POLICY IF EXISTS "Admins podem gerenciar todas configurações" ON public.crossconfig_settings;
DROP POLICY IF EXISTS "Todos podem visualizar configurações" ON public.crossconfig_settings;
DROP POLICY IF EXISTS "Admins podem visualizar logs" ON public.crossconfig_logs;
DROP POLICY IF EXISTS "Admins podem gerenciar versões" ON public.crossconfig_versions;

-- Policies para crossconfig_settings
CREATE POLICY "Admins podem gerenciar todas configurações"
  ON public.crossconfig_settings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Todos podem visualizar configurações"
  ON public.crossconfig_settings
  FOR SELECT
  USING (true);

-- Policies para crossconfig_logs
CREATE POLICY "Admins podem visualizar logs"
  ON public.crossconfig_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'gestor_setor')
    )
  );

-- Policies para crossconfig_versions
CREATE POLICY "Admins podem gerenciar versões"
  ON public.crossconfig_versions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ============================================
-- MIGRAÇÃO DE DADOS EXISTENTES
-- ============================================

-- Migrar de settings (se existir)
INSERT INTO public.crossconfig_settings (category, param, value, description, editable)
SELECT 
  CASE 
    WHEN key LIKE '%typebot%' THEN 'integracoes'
    WHEN key LIKE '%notion%' THEN 'integracoes'
    WHEN key LIKE '%zapi%' THEN 'integracoes'
    WHEN key LIKE '%company%' THEN 'branding'
    WHEN key LIKE '%role%' OR key LIKE '%training%' THEN 'onboarding'
    ELSE 'modulos'
  END as category,
  key as param,
  CASE 
    WHEN jsonb_typeof(value) = 'string' THEN jsonb_build_object('value', value)
    ELSE value
  END as value,
  CONCAT('Migrado de settings - ', key) as description,
  true as editable
FROM public.settings
WHERE key IS NOT NULL
ON CONFLICT (category, param) DO NOTHING;

-- Migrar de automation_settings
INSERT INTO public.crossconfig_settings (category, param, value, description, editable)
SELECT 
  CASE 
    WHEN key LIKE '%feed%' THEN 'modulos'
    WHEN key LIKE '%training%' THEN 'rotinas'
    WHEN key LIKE '%inactive%' THEN 'usuarios'
    WHEN key LIKE '%girabot%' THEN 'ia'
    ELSE 'rotinas'
  END as category,
  key as param,
  value,
  description,
  true as editable
FROM public.automation_settings
WHERE key IS NOT NULL
ON CONFLICT (category, param) DO NOTHING;

-- Migrar de mural_settings
INSERT INTO public.crossconfig_settings (category, param, value, description, editable)
SELECT 
  'mural' as category,
  key as param,
  value,
  description,
  true as editable
FROM public.mural_settings
WHERE key IS NOT NULL
ON CONFLICT (category, param) DO NOTHING;

-- ============================================
-- ÍNDICES PARA PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_crossconfig_settings_category ON public.crossconfig_settings(category);
CREATE INDEX IF NOT EXISTS idx_crossconfig_settings_param ON public.crossconfig_settings(param);
CREATE INDEX IF NOT EXISTS idx_crossconfig_logs_user_id ON public.crossconfig_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_crossconfig_logs_timestamp ON public.crossconfig_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_crossconfig_versions_created_at ON public.crossconfig_versions(created_at DESC);

-- ============================================
-- FUNÇÃO AUXILIAR: Criar Snapshot de Versão
-- ============================================

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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNÇÃO AUXILIAR: Restaurar Snapshot
-- ============================================

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
$$ LANGUAGE plpgsql SECURITY DEFINER;