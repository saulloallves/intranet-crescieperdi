-- FASE 1: EVOLUÇÃO DO BANCO DE DADOS (FINAL)
-- Atualizar tabela ideas com novos campos para votação e implementação

-- Adicionar novos campos à tabela ideas
ALTER TABLE ideas 
  -- Público-alvo
  ADD COLUMN IF NOT EXISTS target_audience TEXT DEFAULT 'ambos',
  
  -- Controle de votação
  ADD COLUMN IF NOT EXISTS vote_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS vote_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS positive_votes INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS negative_votes INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_votes INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quorum NUMERIC(5,2),
  
  -- Implementação
  ADD COLUMN IF NOT EXISTS implemented_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS implementation_deadline DATE,
  ADD COLUMN IF NOT EXISTS implementation_notes TEXT;

-- Adicionar constraint para target_audience
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ideas_target_audience_check'
  ) THEN
    ALTER TABLE ideas ADD CONSTRAINT ideas_target_audience_check 
      CHECK (target_audience IN ('colaboradores', 'franqueados', 'ambos'));
  END IF;
END $$;

-- Atualizar constraint de status para incluir status antigos E novos
ALTER TABLE ideas DROP CONSTRAINT IF EXISTS ideas_status_check;
ALTER TABLE ideas ADD CONSTRAINT ideas_status_check 
  CHECK (status IN ('pending', 'approved', 'rejected', 
                    'triagem', 'aprovada_para_votacao', 'em_votacao', 
                    'encerrada', 'aprovada', 'recusada', 'em_implementacao', 'implementada'));

-- Migrar dados existentes
UPDATE ideas SET target_audience = 'ambos' WHERE target_audience IS NULL;

-- Criar nova tabela ideas_votes (substituindo idea_votes)
CREATE TABLE IF NOT EXISTS ideas_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id UUID NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vote BOOLEAN NOT NULL, -- true = like, false = dislike
  comment TEXT CHECK (LENGTH(comment) <= 140),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(idea_id, user_id)
);

-- RLS Policies para ideas_votes
ALTER TABLE ideas_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can create own votes" ON ideas_votes;
CREATE POLICY "Users can create own votes"
  ON ideas_votes FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own votes" ON ideas_votes;
CREATE POLICY "Users can update own votes"
  ON ideas_votes FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own votes" ON ideas_votes;
CREATE POLICY "Users can delete own votes"
  ON ideas_votes FOR DELETE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view all votes" ON ideas_votes;
CREATE POLICY "Users can view all votes"
  ON ideas_votes FOR SELECT
  USING (true);

-- Função para atualizar contadores de votos
CREATE OR REPLACE FUNCTION update_idea_vote_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE ideas 
    SET 
      positive_votes = COALESCE(positive_votes, 0) + CASE WHEN NEW.vote = true THEN 1 ELSE 0 END,
      negative_votes = COALESCE(negative_votes, 0) + CASE WHEN NEW.vote = false THEN 1 ELSE 0 END,
      total_votes = COALESCE(positive_votes, 0) + COALESCE(negative_votes, 0) + 1
    WHERE id = NEW.idea_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.vote <> NEW.vote THEN
      UPDATE ideas 
      SET 
        positive_votes = COALESCE(positive_votes, 0) + CASE WHEN NEW.vote = true THEN 1 ELSE -1 END,
        negative_votes = COALESCE(negative_votes, 0) + CASE WHEN NEW.vote = false THEN 1 ELSE -1 END
      WHERE id = NEW.idea_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE ideas 
    SET 
      positive_votes = GREATEST(COALESCE(positive_votes, 0) - CASE WHEN OLD.vote = true THEN 1 ELSE 0 END, 0),
      negative_votes = GREATEST(COALESCE(negative_votes, 0) - CASE WHEN OLD.vote = false THEN 1 ELSE 0 END, 0),
      total_votes = GREATEST(COALESCE(total_votes, 0) - 1, 0)
    WHERE id = OLD.idea_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger para atualizar contadores
DROP TRIGGER IF EXISTS idea_vote_count_trigger ON ideas_votes;
CREATE TRIGGER idea_vote_count_trigger
  AFTER INSERT OR UPDATE OR DELETE ON ideas_votes
  FOR EACH ROW EXECUTE FUNCTION update_idea_vote_counts();

-- Inserir configurações em settings
INSERT INTO settings (key, value, description) VALUES
  ('ideas_voting_quorum', '{"percentage": 80}'::jsonb, 'Percentual mínimo de aprovação (80%)'),
  ('ideas_voting_duration_days', '{"days": 7}'::jsonb, 'Duração padrão da votação em dias'),
  ('ideas_require_target_audience', '{"required": true}'::jsonb, 'Exige definição de público-alvo'),
  ('ideas_auto_close_voting', '{"enabled": true}'::jsonb, 'Encerra votação automaticamente após prazo'),
  ('ideas_max_per_user_month', '{"limit": 5}'::jsonb, 'Limite de ideias por usuário/mês'),
  ('ideas_auto_publish_to_feed', '{"enabled": true}'::jsonb, 'Publicar ideias implementadas automaticamente no feed'),
  ('ideas_whatsapp_notifications', '{"enabled": true}'::jsonb, 'Enviar notificações via WhatsApp'),
  ('ideas_ai_classification_enabled', '{"enabled": true}'::jsonb, 'Classificação automática por IA'),
  ('ideas_ai_duplicate_detection', '{"enabled": true}'::jsonb, 'Detecção de duplicatas por IA'),
  ('ideas_weekly_reports', '{"enabled": true}'::jsonb, 'Relatórios semanais automáticos')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description;