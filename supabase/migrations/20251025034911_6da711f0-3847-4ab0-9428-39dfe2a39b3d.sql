-- Create trainings table (treinamentos)
CREATE TABLE public.trainings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  content TEXT,
  video_url TEXT,
  category TEXT NOT NULL,
  target_roles public.user_role[],
  duration_minutes INTEGER,
  is_published BOOLEAN DEFAULT false,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create training_progress table
CREATE TABLE public.training_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  training_id UUID REFERENCES public.trainings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  completed BOOLEAN DEFAULT false,
  progress_percentage INTEGER DEFAULT 0,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(training_id, user_id)
);

-- Create checklists table
CREATE TABLE public.checklists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL,
  frequency TEXT NOT NULL,
  questions JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create checklist_responses table
CREATE TABLE public.checklist_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  checklist_id UUID REFERENCES public.checklists(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  unit_code TEXT,
  responses JSONB NOT NULL,
  status TEXT DEFAULT 'pending',
  photos JSONB,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create knowledge_base table (manuais)
CREATE TABLE public.knowledge_base (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL,
  tags TEXT[],
  file_url TEXT,
  file_type TEXT,
  is_published BOOLEAN DEFAULT true,
  views_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create recognitions table
CREATE TABLE public.recognitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  type TEXT NOT NULL,
  month TEXT,
  year INTEGER,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_published BOOLEAN DEFAULT true,
  likes_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create recognition_likes table
CREATE TABLE public.recognition_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recognition_id UUID REFERENCES public.recognitions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(recognition_id, user_id)
);

-- Create ideas table
CREATE TABLE public.ideas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  submitted_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending',
  votes_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create idea_votes table
CREATE TABLE public.idea_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  idea_id UUID REFERENCES public.ideas(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(idea_id, user_id)
);

-- Create campaigns table
CREATE TABLE public.campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  type TEXT NOT NULL,
  goal_value NUMERIC,
  goal_unit TEXT,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  target_roles public.user_role[],
  target_units TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create campaign_results table
CREATE TABLE public.campaign_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  unit_code TEXT,
  value NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.trainings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recognitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recognition_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.idea_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_results ENABLE ROW LEVEL SECURITY;

-- RLS Policies for trainings
CREATE POLICY "Users can view published trainings"
  ON public.trainings FOR SELECT
  USING (is_published = true);

CREATE POLICY "Admins can manage trainings"
  ON public.trainings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'gestor_setor')
    )
  );

-- RLS Policies for training_progress
CREATE POLICY "Users can view own progress"
  ON public.training_progress FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage own progress"
  ON public.training_progress FOR ALL
  USING (user_id = auth.uid());

-- RLS Policies for checklists
CREATE POLICY "Users can view active checklists"
  ON public.checklists FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage checklists"
  ON public.checklists FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'gestor_setor')
    )
  );

-- RLS Policies for checklist_responses
CREATE POLICY "Users can view own responses"
  ON public.checklist_responses FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own responses"
  ON public.checklist_responses FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- RLS Policies for knowledge_base
CREATE POLICY "Users can view published content"
  ON public.knowledge_base FOR SELECT
  USING (is_published = true);

CREATE POLICY "Admins can manage knowledge base"
  ON public.knowledge_base FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'gestor_setor')
    )
  );

-- RLS Policies for recognitions
CREATE POLICY "Users can view published recognitions"
  ON public.recognitions FOR SELECT
  USING (is_published = true);

CREATE POLICY "Admins can manage recognitions"
  ON public.recognitions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'gestor_setor')
    )
  );

-- RLS Policies for recognition_likes
CREATE POLICY "Users can view all recognition likes"
  ON public.recognition_likes FOR SELECT
  USING (true);

CREATE POLICY "Users can manage own recognition likes"
  ON public.recognition_likes FOR ALL
  USING (user_id = auth.uid());

-- RLS Policies for ideas
CREATE POLICY "Users can view all ideas"
  ON public.ideas FOR SELECT
  USING (true);

CREATE POLICY "Users can create ideas"
  ON public.ideas FOR INSERT
  WITH CHECK (submitted_by = auth.uid());

CREATE POLICY "Admins can manage ideas"
  ON public.ideas FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'gestor_setor')
    )
  );

-- RLS Policies for idea_votes
CREATE POLICY "Users can view all votes"
  ON public.idea_votes FOR SELECT
  USING (true);

CREATE POLICY "Users can manage own votes"
  ON public.idea_votes FOR ALL
  USING (user_id = auth.uid());

-- RLS Policies for campaigns
CREATE POLICY "Users can view active campaigns"
  ON public.campaigns FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage campaigns"
  ON public.campaigns FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'gestor_setor')
    )
  );

-- RLS Policies for campaign_results
CREATE POLICY "Users can view all campaign results"
  ON public.campaign_results FOR SELECT
  USING (true);

CREATE POLICY "Users can create own results"
  ON public.campaign_results FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Triggers for updated_at
CREATE TRIGGER handle_trainings_updated_at
  BEFORE UPDATE ON public.trainings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_training_progress_updated_at
  BEFORE UPDATE ON public.training_progress
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_checklists_updated_at
  BEFORE UPDATE ON public.checklists
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_knowledge_base_updated_at
  BEFORE UPDATE ON public.knowledge_base
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_ideas_updated_at
  BEFORE UPDATE ON public.ideas
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_campaign_results_updated_at
  BEFORE UPDATE ON public.campaign_results
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Insert sample data for trainings
INSERT INTO public.trainings (title, description, category, target_roles, duration_minutes, is_published) VALUES
  ('Introdução à Avaliação de Peças', 'Aprenda os fundamentos da avaliação', 'Avaliação', ARRAY['colaborador', 'gerente']::public.user_role[], 30, true),
  ('Técnicas de Atendimento ao Cliente', 'Como oferecer um atendimento excepcional', 'Atendimento', ARRAY['colaborador', 'gerente']::public.user_role[], 45, true),
  ('Gestão de Estoque', 'Controle e organização do estoque da loja', 'Gestão', ARRAY['gerente']::public.user_role[], 60, true);

-- Insert sample checklists
INSERT INTO public.checklists (title, description, type, frequency, questions) VALUES
  ('Abertura da Loja', 'Checklist para abertura diária', 'abertura', 'daily', 
   '[{"id": "1", "question": "Loja limpa e organizada?", "type": "boolean"}, 
     {"id": "2", "question": "Sistemas ligados?", "type": "boolean"},
     {"id": "3", "question": "Foto da vitrine", "type": "photo"}]'::jsonb),
  ('Fechamento da Loja', 'Checklist para fechamento diário', 'fechamento', 'daily',
   '[{"id": "1", "question": "Dinheiro contado e conferido?", "type": "boolean"},
     {"id": "2", "question": "Luzes apagadas?", "type": "boolean"},
     {"id": "3", "question": "Portas trancadas?", "type": "boolean"}]'::jsonb);

-- Insert sample knowledge base
INSERT INTO public.knowledge_base (title, content, category, tags) VALUES
  ('Manual de Avaliação', 'Guia completo para avaliação de peças usadas...', 'Operação', ARRAY['avaliacao', 'procedimentos']),
  ('Política de Trocas e Devoluções', 'Diretrizes para trocas e devoluções...', 'Atendimento', ARRAY['atendimento', 'politicas']),
  ('FAQ - Perguntas Frequentes', 'Respostas para as dúvidas mais comuns...', 'Geral', ARRAY['faq', 'duvidas']);

-- Insert sample campaigns
INSERT INTO public.campaigns (title, description, type, goal_value, goal_unit, start_date, end_date, is_active) VALUES
  ('Meta de Avaliações - Janeiro', 'Avaliar 300 peças no mês', 'avaliacoes', 300, 'peças', now(), now() + interval '30 days', true),
  ('Campanha de Vendas - Verão', 'Aumentar vendas em 20%', 'vendas', 20, 'percentual', now(), now() + interval '60 days', true);