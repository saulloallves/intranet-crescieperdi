-- Criar tabela de categorias configuráveis do Mural
CREATE TABLE IF NOT EXISTS public.mural_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  description TEXT NOT NULL,
  curator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Inserir categorias padrão com as 7 categorias solicitadas
INSERT INTO public.mural_categories (key, name, icon, color, description, display_order) VALUES
  ('fornecedores', 'Fornecedores e Compras', 'Package', 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20', 'Dúvidas sobre fornecedores, compras e negociações', 1),
  ('operacao', 'Dúvidas Operacionais', 'Cog', 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/20', 'Dúvidas operacionais do dia a dia', 2),
  ('sistemas', 'Sistema / DFCom', 'Monitor', 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/20', 'Problemas e dúvidas técnicas sobre sistemas', 3),
  ('vendas', 'Estratégias de Venda', 'TrendingUp', 'bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20', 'Estratégias, técnicas e dicas de vendas', 4),
  ('treinamento', 'Treinamento e Equipe', 'GraduationCap', 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20', 'Desenvolvimento de equipe e capacitação', 5),
  ('juridico', 'Jurídico e Contratos', 'Scale', 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20', 'Questões legais, contratuais e compliance', 6),
  ('ideias', 'Ideias e Boas Práticas', 'Lightbulb', 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 border-yellow-500/20', 'Sugestões, melhorias e boas práticas', 7);

-- Adicionar coluna category_id em mural_posts (nova FK)
ALTER TABLE public.mural_posts
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.mural_categories(id) ON DELETE SET NULL;

-- Migrar dados existentes do enum para a nova FK
UPDATE public.mural_posts mp
SET category_id = mc.id
FROM public.mural_categories mc
WHERE mp.category::text = mc.key;

-- Tornar category_id obrigatório após migração
ALTER TABLE public.mural_posts
  ALTER COLUMN category_id SET NOT NULL;

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_mural_posts_category_id ON public.mural_posts(category_id);
CREATE INDEX IF NOT EXISTS idx_mural_categories_curator ON public.mural_categories(curator_id);
CREATE INDEX IF NOT EXISTS idx_mural_categories_active ON public.mural_categories(is_active);

-- RLS Policies para mural_categories
ALTER TABLE public.mural_categories ENABLE ROW LEVEL SECURITY;

-- Todos podem ver categorias ativas
CREATE POLICY "Everyone can view active categories"
  ON public.mural_categories
  FOR SELECT
  USING (is_active = true);

-- Admins podem gerenciar categorias
CREATE POLICY "Admins can manage categories"
  ON public.mural_categories
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Curadores podem ver suas categorias
CREATE POLICY "Curators can view their categories"
  ON public.mural_categories
  FOR SELECT
  USING (curator_id = auth.uid());

-- Trigger para atualizar updated_at
CREATE TRIGGER update_mural_categories_updated_at
  BEFORE UPDATE ON public.mural_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Comentários
COMMENT ON TABLE public.mural_categories IS 'Categorias configuráveis do Mural com sistema de curadoria';
COMMENT ON COLUMN public.mural_categories.curator_id IS 'Curador interno responsável por acompanhar posts desta categoria';
COMMENT ON COLUMN public.mural_categories.key IS 'Chave única para identificação programática da categoria';
COMMENT ON COLUMN public.mural_categories.icon IS 'Nome do ícone Lucide React a ser usado';
COMMENT ON COLUMN public.mural_categories.color IS 'Classes Tailwind para cores do badge';
COMMENT ON COLUMN public.mural_categories.display_order IS 'Ordem de exibição das categorias';