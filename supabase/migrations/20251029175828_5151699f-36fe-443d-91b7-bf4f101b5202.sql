-- ============================================
-- FASE 1: EXPANSÃO DO SISTEMA DE USUÁRIOS
-- ============================================

-- 1. Expandir tabela profiles com novos campos (alguns já existem)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_ip TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS unit_codes TEXT[] DEFAULT '{}';

-- 2. Criar tabela permissions (matriz de permissões)
CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL,
  module TEXT NOT NULL,
  access_level TEXT NOT NULL CHECK (access_level IN ('none', 'read', 'write', 'admin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(role, module)
);

-- 3. Criar tabela activity_logs (auditoria)
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  module TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address TEXT,
  device TEXT,
  result TEXT CHECK (result IN ('success', 'error')),
  metadata JSONB DEFAULT '{}'
);

-- 4. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_timestamp ON public.activity_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_module ON public.activity_logs(module);
CREATE INDEX IF NOT EXISTS idx_permissions_role ON public.permissions(role);
CREATE INDEX IF NOT EXISTS idx_permissions_module ON public.permissions(module);

-- 5. RLS para permissions
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage permissions" ON public.permissions;
CREATE POLICY "Admins can manage permissions"
  ON public.permissions FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Everyone can view permissions" ON public.permissions;
CREATE POLICY "Everyone can view permissions"
  ON public.permissions FOR SELECT
  USING (true);

-- 6. RLS para activity_logs
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own logs" ON public.activity_logs;
CREATE POLICY "Users can view own logs"
  ON public.activity_logs FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all logs" ON public.activity_logs;
CREATE POLICY "Admins can view all logs"
  ON public.activity_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "System can create logs" ON public.activity_logs;
CREATE POLICY "System can create logs"
  ON public.activity_logs FOR INSERT
  WITH CHECK (true);

-- 7. Trigger atualizar updated_at em permissions
CREATE OR REPLACE FUNCTION update_permissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_permissions_updated_at ON public.permissions;
CREATE TRIGGER trigger_update_permissions_updated_at
  BEFORE UPDATE ON public.permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_permissions_updated_at();

-- 8. Inserir permissões padrão por papel
INSERT INTO public.permissions (role, module, access_level) VALUES
  -- Admin tem acesso total a tudo
  ('admin', 'users', 'admin'),
  ('admin', 'dashboard', 'admin'),
  ('admin', 'feed', 'admin'),
  ('admin', 'mural', 'admin'),
  ('admin', 'ideias', 'admin'),
  ('admin', 'treinamentos', 'admin'),
  ('admin', 'reconhecimento', 'admin'),
  ('admin', 'comunicados', 'admin'),
  ('admin', 'campanhas', 'admin'),
  ('admin', 'pesquisas', 'admin'),
  ('admin', 'checklists', 'admin'),
  ('admin', 'manuais', 'admin'),
  ('admin', 'midias', 'admin'),
  ('admin', 'suporte', 'admin'),
  ('admin', 'busca', 'admin'),
  ('admin', 'notificacoes', 'admin'),
  ('admin', 'girabot', 'admin'),
  ('admin', 'conteudos_obrigatorios', 'admin'),
  
  -- Gestor de Setor
  ('gestor_setor', 'dashboard', 'read'),
  ('gestor_setor', 'feed', 'write'),
  ('gestor_setor', 'mural', 'admin'),
  ('gestor_setor', 'ideias', 'write'),
  ('gestor_setor', 'treinamentos', 'read'),
  ('gestor_setor', 'reconhecimento', 'write'),
  ('gestor_setor', 'comunicados', 'write'),
  ('gestor_setor', 'campanhas', 'read'),
  ('gestor_setor', 'pesquisas', 'write'),
  ('gestor_setor', 'checklists', 'write'),
  ('gestor_setor', 'manuais', 'read'),
  ('gestor_setor', 'suporte', 'read'),
  
  -- Franqueado
  ('franqueado', 'dashboard', 'read'),
  ('franqueado', 'feed', 'read'),
  ('franqueado', 'mural', 'read'),
  ('franqueado', 'ideias', 'write'),
  ('franqueado', 'treinamentos', 'read'),
  ('franqueado', 'reconhecimento', 'read'),
  ('franqueado', 'comunicados', 'read'),
  ('franqueado', 'campanhas', 'read'),
  ('franqueado', 'checklists', 'write'),
  ('franqueado', 'manuais', 'read'),
  
  -- Colaborador
  ('colaborador', 'dashboard', 'read'),
  ('colaborador', 'feed', 'read'),
  ('colaborador', 'mural', 'write'),
  ('colaborador', 'ideias', 'write'),
  ('colaborador', 'treinamentos', 'read'),
  ('colaborador', 'reconhecimento', 'read'),
  ('colaborador', 'comunicados', 'read'),
  ('colaborador', 'campanhas', 'read'),
  ('colaborador', 'checklists', 'write'),
  ('colaborador', 'manuais', 'read'),
  ('colaborador', 'suporte', 'write')
ON CONFLICT (role, module) DO NOTHING;

-- 9. Função auxiliar para verificar permissão específica
CREATE OR REPLACE FUNCTION public.check_permission(_user_id UUID, _module TEXT, _required_level TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
  user_access_level TEXT;
BEGIN
  -- Buscar o papel do usuário
  SELECT role INTO user_role FROM public.profiles WHERE id = _user_id;
  
  IF user_role IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Buscar nível de acesso para este papel e módulo
  SELECT access_level INTO user_access_level 
  FROM public.permissions 
  WHERE role = user_role AND module = _module;
  
  IF user_access_level IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Verificar hierarquia de permissões: admin > write > read > none
  CASE _required_level
    WHEN 'none' THEN RETURN TRUE;
    WHEN 'read' THEN RETURN user_access_level IN ('read', 'write', 'admin');
    WHEN 'write' THEN RETURN user_access_level IN ('write', 'admin');
    WHEN 'admin' THEN RETURN user_access_level = 'admin';
    ELSE RETURN FALSE;
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;