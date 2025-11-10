-- FASE 1 & 9: Evolução completa do banco de dados e storage

-- 1. Adicionar novos campos à tabela ideas
ALTER TABLE ideas 
  ADD COLUMN IF NOT EXISTS code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS media_urls JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ai_category TEXT,
  ADD COLUMN IF NOT EXISTS feedback TEXT,
  ADD COLUMN IF NOT EXISTS curator_id UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS viability_level TEXT DEFAULT 'medio' CHECK (viability_level IN ('baixo', 'medio', 'alto')),
  ADD COLUMN IF NOT EXISTS impact_level TEXT DEFAULT 'medio' CHECK (impact_level IN ('baixo', 'medio', 'alto')),
  ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
  ADD COLUMN IF NOT EXISTS unit_code TEXT,
  ADD COLUMN IF NOT EXISTS evaluating_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

-- 2. Atualizar constraint de status
ALTER TABLE ideas DROP CONSTRAINT IF EXISTS ideas_status_check;
ALTER TABLE ideas ADD CONSTRAINT ideas_status_check 
  CHECK (status IN ('pendente', 'avaliando', 'aprovada', 'recusada', 'implementada', 'pending', 'approved', 'rejected', 'implemented'));

-- 3. Função para gerar código automático
CREATE OR REPLACE FUNCTION generate_idea_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.code IS NULL THEN
    NEW.code := 'IDEA-' || 
                EXTRACT(YEAR FROM NEW.created_at)::TEXT || '-' || 
                LPAD((SELECT COUNT(*) + 1 FROM ideas WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NEW.created_at))::TEXT, 3, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Trigger para código automático
DROP TRIGGER IF EXISTS set_idea_code ON ideas;
CREATE TRIGGER set_idea_code
  BEFORE INSERT ON ideas
  FOR EACH ROW
  EXECUTE FUNCTION generate_idea_code();

-- 5. Atualizar códigos existentes (retroativo)
DO $$
DECLARE
  idea_record RECORD;
  counter INT := 0;
  current_year INT;
BEGIN
  FOR idea_record IN (SELECT id, created_at FROM ideas WHERE code IS NULL ORDER BY created_at)
  LOOP
    IF current_year IS NULL OR current_year != EXTRACT(YEAR FROM idea_record.created_at) THEN
      current_year := EXTRACT(YEAR FROM idea_record.created_at);
      counter := 0;
    END IF;
    counter := counter + 1;
    UPDATE ideas 
    SET code = 'IDEA-' || current_year::TEXT || '-' || LPAD(counter::TEXT, 3, '0')
    WHERE id = idea_record.id;
  END LOOP;
END $$;

-- 6. Criar tabela ideas_feedback
CREATE TABLE IF NOT EXISTS ideas_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id UUID NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  curator_id UUID REFERENCES profiles(id),
  feedback_text TEXT NOT NULL,
  status_update TEXT NOT NULL CHECK (status_update IN ('pendente', 'avaliando', 'aprovada', 'recusada', 'implementada')),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ideas_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view feedback on own ideas"
  ON ideas_feedback FOR SELECT
  USING (
    idea_id IN (SELECT id FROM ideas WHERE submitted_by = auth.uid())
  );

CREATE POLICY "Admins can manage all feedback"
  ON ideas_feedback FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'gestor_setor')
    )
  );

-- 7. Criar tabela ideas_notifications
CREATE TABLE IF NOT EXISTS ideas_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  idea_id UUID REFERENCES ideas(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('vote', 'status', 'feedback', 'highlight')),
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ideas_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON ideas_notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON ideas_notifications FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "System can create notifications"
  ON ideas_notifications FOR INSERT
  WITH CHECK (true);

-- 8. Criar tabela ideas_analytics
CREATE TABLE IF NOT EXISTS ideas_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_ideas INT NOT NULL,
  approved_ideas INT NOT NULL,
  implemented_ideas INT NOT NULL,
  total_votes INT NOT NULL,
  most_active_units JSONB DEFAULT '[]'::jsonb,
  top_categories JSONB DEFAULT '[]'::jsonb,
  ai_insights TEXT,
  generated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ideas_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view analytics"
  ON ideas_analytics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'gestor_setor')
    )
  );

CREATE POLICY "System can create analytics"
  ON ideas_analytics FOR INSERT
  WITH CHECK (true);

-- 9. Configurações CrossConfig
INSERT INTO settings (key, value, description) VALUES
  ('ideas_ai_classification_enabled', '{"enabled": true}'::jsonb, 'Habilita classificação automática por IA'),
  ('ideas_public_voting_enabled', '{"enabled": true}'::jsonb, 'Permite votação pública'),
  ('ideas_feedback_required', '{"required": true}'::jsonb, 'Exige feedback obrigatório da curadoria'),
  ('ideas_vote_limit_per_user', '{"limit": 10}'::jsonb, 'Limite de votos diários por usuário'),
  ('ideas_highlight_threshold', '{"threshold": 10}'::jsonb, 'Número de votos para destaque no feed'),
  ('ideas_auto_publish_to_feed', '{"enabled": true}'::jsonb, 'Publica ideias aprovadas automaticamente no feed')
ON CONFLICT (key) DO NOTHING;

-- 10. Criar bucket de storage para ideias (ideas-media)
INSERT INTO storage.buckets (id, name, public)
VALUES ('ideas-media', 'ideas-media', true)
ON CONFLICT (id) DO NOTHING;

-- 11. RLS Policies para storage
CREATE POLICY "Anyone can view ideas media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'ideas-media');

CREATE POLICY "Authenticated users can upload ideas media"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'ideas-media' 
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can update their own media"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'ideas-media' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own media"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'ideas-media' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );