-- Create training_paths table (jornadas/trilhas estruturadas por cargo)
CREATE TABLE IF NOT EXISTS public.training_paths (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  target_role text NOT NULL CHECK (target_role IN (
    'avaliadora', 'gerente', 'social_midia', 'operador_caixa', 
    'franqueado', 'suporte', 'colaborador', 'admin'
  )),
  icon text DEFAULT 'graduation-cap',
  color text DEFAULT '#ec4899',
  estimated_duration_hours integer NOT NULL DEFAULT 4,
  is_active boolean DEFAULT true,
  order_index integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create training_path_items table (módulos dentro da trilha)
CREATE TABLE IF NOT EXISTS public.training_path_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path_id uuid REFERENCES public.training_paths(id) ON DELETE CASCADE NOT NULL,
  training_id uuid REFERENCES public.trainings(id) ON DELETE CASCADE NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  is_required boolean DEFAULT true,
  unlock_after uuid REFERENCES public.training_path_items(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Create user_training_paths table (progresso do usuário na trilha)
CREATE TABLE IF NOT EXISTS public.user_training_paths (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  path_id uuid REFERENCES public.training_paths(id) ON DELETE CASCADE NOT NULL,
  started_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  progress_percentage integer DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  current_item_id uuid REFERENCES public.training_path_items(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, path_id)
);

-- Create training_feedback table (feedback pós-treinamento)
CREATE TABLE IF NOT EXISTS public.training_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  training_id uuid REFERENCES public.trainings(id) ON DELETE CASCADE NOT NULL,
  clarity_rating integer NOT NULL CHECK (clarity_rating >= 1 AND clarity_rating <= 5),
  preparedness_rating integer NOT NULL CHECK (preparedness_rating >= 1 AND preparedness_rating <= 5),
  content_relevance_rating integer NOT NULL CHECK (content_relevance_rating >= 1 AND content_relevance_rating <= 5),
  comments text,
  would_recommend boolean DEFAULT true,
  submitted_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

-- Create training_quiz_attempts table (tentativas de quiz detalhadas)
CREATE TABLE IF NOT EXISTS public.training_quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  training_id uuid REFERENCES public.trainings(id) ON DELETE CASCADE NOT NULL,
  module_id text NOT NULL,
  attempt_number integer NOT NULL DEFAULT 1,
  score integer NOT NULL CHECK (score >= 0 AND score <= 100),
  passed boolean NOT NULL DEFAULT false,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  time_spent_seconds integer,
  completed_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.training_paths ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_path_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_training_paths ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_quiz_attempts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for training_paths
CREATE POLICY "Users can view active training paths"
  ON public.training_paths FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage training paths"
  ON public.training_paths FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'gestor_setor')
    )
  );

-- RLS Policies for training_path_items
CREATE POLICY "Users can view training path items"
  ON public.training_path_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.training_paths
      WHERE id = training_path_items.path_id AND is_active = true
    )
  );

CREATE POLICY "Admins can manage training path items"
  ON public.training_path_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'gestor_setor')
    )
  );

-- RLS Policies for user_training_paths
CREATE POLICY "Users can view own training path progress"
  ON public.user_training_paths FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own training path progress"
  ON public.user_training_paths FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "System can create user training paths"
  ON public.user_training_paths FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view all training path progress"
  ON public.user_training_paths FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'gestor_setor')
    )
  );

-- RLS Policies for training_feedback
CREATE POLICY "Users can view own feedback"
  ON public.training_feedback FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own feedback"
  ON public.training_feedback FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all feedback"
  ON public.training_feedback FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'gestor_setor')
    )
  );

-- RLS Policies for training_quiz_attempts
CREATE POLICY "Users can view own quiz attempts"
  ON public.training_quiz_attempts FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own quiz attempts"
  ON public.training_quiz_attempts FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all quiz attempts"
  ON public.training_quiz_attempts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'gestor_setor')
    )
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_training_paths_target_role ON public.training_paths(target_role);
CREATE INDEX IF NOT EXISTS idx_training_path_items_path_id ON public.training_path_items(path_id);
CREATE INDEX IF NOT EXISTS idx_training_path_items_training_id ON public.training_path_items(training_id);
CREATE INDEX IF NOT EXISTS idx_user_training_paths_user_id ON public.user_training_paths(user_id);
CREATE INDEX IF NOT EXISTS idx_user_training_paths_path_id ON public.user_training_paths(path_id);
CREATE INDEX IF NOT EXISTS idx_training_feedback_training_id ON public.training_feedback(training_id);
CREATE INDEX IF NOT EXISTS idx_training_quiz_attempts_user_training ON public.training_quiz_attempts(user_id, training_id);

-- Triggers for updated_at
CREATE TRIGGER handle_training_paths_updated_at
  BEFORE UPDATE ON public.training_paths
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_user_training_paths_updated_at
  BEFORE UPDATE ON public.user_training_paths
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Insert sample training paths
INSERT INTO public.training_paths (name, description, target_role, estimated_duration_hours, order_index)
VALUES
  (
    'Jornada de Avaliadora',
    'Trilha completa para formação de avaliadoras, desde o básico até técnicas avançadas de precificação.',
    'avaliadora',
    4,
    1
  ),
  (
    'Jornada de Gerente',
    'Formação completa em gestão de loja, equipe e indicadores de performance.',
    'gerente',
    6,
    2
  ),
  (
    'Jornada de Social Mídia',
    'Capacitação em criação de conteúdo, engajamento e gestão de redes sociais.',
    'social_midia',
    3,
    3
  ),
  (
    'Jornada de Operador de Caixa',
    'Treinamento completo em operações de caixa, fechamento e atendimento ao cliente.',
    'operador_caixa',
    3,
    4
  ),
  (
    'Jornada de Franqueado',
    'Capacitação completa em gestão de franquia, administrativo e liderança.',
    'franqueado',
    8,
    5
  ),
  (
    'Jornada de Suporte',
    'Formação em atendimento técnico, resolução de problemas e comunicação com unidades.',
    'suporte',
    5,
    6
  )
ON CONFLICT DO NOTHING;

-- Insert sample training path items (linking trainings to paths)
-- This will be done via admin interface based on existing trainings

-- Create automation settings for onboarding
INSERT INTO public.automation_settings (key, value, description)
VALUES 
  (
    'onboarding_auto_assign',
    'true'::jsonb,
    'Ativar atribuição automática de trilhas de treinamento no onboarding'
  ),
  (
    'default_training_by_role',
    '{
      "avaliadora": null,
      "gerente": null,
      "social_midia": null,
      "operador_caixa": null,
      "franqueado": null,
      "suporte": null
    }'::jsonb,
    'Mapeamento de cargos para IDs de trilhas (training_paths) - configurar via admin'
  )
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description;

-- Function to auto-update user_training_paths progress when training_progress changes
CREATE OR REPLACE FUNCTION update_training_path_progress()
RETURNS TRIGGER AS $$
DECLARE
  v_path_id uuid;
  v_total_items integer;
  v_completed_items integer;
  v_new_percentage integer;
BEGIN
  -- Find which training path this training belongs to for this user
  SELECT utp.path_id INTO v_path_id
  FROM public.user_training_paths utp
  JOIN public.training_path_items tpi ON tpi.path_id = utp.path_id
  WHERE utp.user_id = NEW.user_id
    AND tpi.training_id = NEW.training_id
  LIMIT 1;

  IF v_path_id IS NOT NULL THEN
    -- Count total items in path
    SELECT COUNT(*) INTO v_total_items
    FROM public.training_path_items
    WHERE path_id = v_path_id;

    -- Count completed items
    SELECT COUNT(*) INTO v_completed_items
    FROM public.training_path_items tpi
    JOIN public.training_progress tp ON tp.training_id = tpi.training_id
    WHERE tpi.path_id = v_path_id
      AND tp.user_id = NEW.user_id
      AND tp.completed = true;

    -- Calculate percentage
    IF v_total_items > 0 THEN
      v_new_percentage := (v_completed_items * 100 / v_total_items);
    ELSE
      v_new_percentage := 0;
    END IF;

    -- Update user training path progress
    UPDATE public.user_training_paths
    SET 
      progress_percentage = v_new_percentage,
      completed_at = CASE 
        WHEN v_new_percentage >= 100 THEN now()
        ELSE NULL
      END,
      updated_at = now()
    WHERE user_id = NEW.user_id AND path_id = v_path_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update path progress when training is completed
CREATE TRIGGER training_progress_update_path
  AFTER INSERT OR UPDATE ON public.training_progress
  FOR EACH ROW
  WHEN (NEW.completed = true)
  EXECUTE FUNCTION update_training_path_progress();

COMMENT ON TABLE public.training_paths IS 'Trilhas/jornadas de treinamento estruturadas por cargo';
COMMENT ON TABLE public.training_path_items IS 'Módulos/treinamentos que compõem cada trilha';
COMMENT ON TABLE public.user_training_paths IS 'Progresso dos usuários nas trilhas de treinamento';
COMMENT ON TABLE public.training_feedback IS 'Feedback dos colaboradores após conclusão de treinamentos';
COMMENT ON TABLE public.training_quiz_attempts IS 'Histórico detalhado de tentativas de quiz';

