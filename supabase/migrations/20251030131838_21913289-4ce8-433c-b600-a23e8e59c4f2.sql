-- ============================================================================
-- CORREÇÃO: Recursão Infinita nas Políticas RLS da Tabela profiles
-- ============================================================================
-- Problema: Políticas RLS com subqueries consultando a própria tabela profiles
-- causavam erro "infinite recursion detected in policy"
-- 
-- Solução: Criar funções SECURITY DEFINER que fazem bypass das políticas RLS
-- Referência: https://supabase.com/docs/guides/auth/row-level-security
-- ============================================================================

-- FASE 1: Criar Funções SECURITY DEFINER (sem recursão)
-- ============================================================================

-- Função para buscar role do usuário sem passar por RLS
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = _user_id LIMIT 1;
$$;

-- Função para buscar unit_code do usuário sem passar por RLS
CREATE OR REPLACE FUNCTION public.get_user_unit_code(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT unit_code FROM public.profiles WHERE id = _user_id LIMIT 1;
$$;

-- FASE 2: Remover Políticas com Recursão
-- ============================================================================

DROP POLICY IF EXISTS "Users can update own profile data" ON public.profiles;
DROP POLICY IF EXISTS "Gestores can view unit profiles" ON public.profiles;

-- FASE 3: Recriar Políticas SEM Recursão
-- ============================================================================

-- ✅ Política de UPDATE: Usuários podem atualizar seu próprio perfil
-- (mas não podem mudar o próprio role)
CREATE POLICY "Users can update own profile data"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id AND
  role = public.get_user_role(auth.uid())
  -- ↑ Usa função SECURITY DEFINER, evita recursão
);

-- ✅ Política de SELECT: Gestores podem ver perfis da sua unidade
CREATE POLICY "Gestores can view unit profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'gestor_setor'::user_role) AND
  unit_code = public.get_user_unit_code(auth.uid())
  -- ↑ Usa função SECURITY DEFINER, evita recursão
);

-- ============================================================================
-- FIM DA CORREÇÃO
-- ============================================================================
-- Resultado esperado:
-- ✅ Queries em profiles funcionam normalmente
-- ✅ Queries em feed_posts, campaigns, etc. funcionam
-- ✅ Sistema completo volta a funcionar
-- ✅ RLS continua protegendo dados corretamente
-- ============================================================================