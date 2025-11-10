-- Create training_categories table
CREATE TABLE public.training_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  description text,
  icon text DEFAULT 'FolderOpen',
  color text DEFAULT '#3b82f6',
  order_index integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.training_categories ENABLE ROW LEVEL SECURITY;

-- Everyone can view active categories
CREATE POLICY "Everyone can view active categories"
  ON public.training_categories
  FOR SELECT
  USING (is_active = true);

-- Admins can manage categories
CREATE POLICY "Admins can manage categories"
  ON public.training_categories
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = ANY(ARRAY['admin'::user_role, 'gestor_setor'::user_role])
    )
  );

-- Trigger for updated_at
CREATE TRIGGER handle_training_categories_updated_at
  BEFORE UPDATE ON public.training_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Insert default categories
INSERT INTO public.training_categories (name, slug, description, icon, color, order_index) VALUES
  ('Operacional', 'operacional', 'Treinamentos sobre processos operacionais e procedimentos diários', 'Settings', '#3b82f6', 1),
  ('Vendas', 'vendas', 'Técnicas de vendas, negociação e atendimento ao cliente', 'TrendingUp', '#10b981', 2),
  ('Atendimento', 'atendimento', 'Qualidade no atendimento e experiência do cliente', 'Headphones', '#f59e0b', 3),
  ('Gestão', 'gestao', 'Liderança, gestão de equipes e processos gerenciais', 'Users', '#8b5cf6', 4);