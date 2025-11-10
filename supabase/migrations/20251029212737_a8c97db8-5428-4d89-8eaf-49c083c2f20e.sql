-- Criar tabela faq_training para base de conhecimento treinável
CREATE TABLE IF NOT EXISTS public.faq_training (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  context TEXT NOT NULL DEFAULT 'general',
  active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_faq_training_context ON public.faq_training(context);
CREATE INDEX IF NOT EXISTS idx_faq_training_active ON public.faq_training(active);

-- Habilitar RLS
ALTER TABLE public.faq_training ENABLE ROW LEVEL SECURITY;

-- Policies para faq_training
CREATE POLICY "Everyone can view active FAQ"
  ON public.faq_training FOR SELECT
  USING (active = true);

CREATE POLICY "Admins can manage FAQ"
  ON public.faq_training FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'gestor_setor')
  ));

-- Atualizar tabela ai_sessions para incluir coluna answer (alias para response)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ai_sessions' AND column_name = 'answer'
  ) THEN
    ALTER TABLE public.ai_sessions ADD COLUMN answer TEXT;
  END IF;
END $$;

-- Inserir configurações padrão do GiraBot em girabot_settings
INSERT INTO public.girabot_settings (key, value, description) VALUES
  ('girabot_enabled', '{"enabled": true}'::jsonb, 'Ativa/desativa IA global'),
  ('global_context_depth', '{"depth": 4000}'::jsonb, 'Nível de contexto em tokens'),
  ('girabot_temperature', '{"temperature": 0.7}'::jsonb, 'Temperatura de resposta da IA'),
  ('connect_with_search', '{"enabled": true}'::jsonb, 'Integra com Busca Global'),
  ('girabot_context_prompt', '{"prompt": "Você é o GiraBot, assistente institucional da Cresci e Perdi. Responda de forma clara, objetiva e amigável."}'::jsonb, 'Prompt base institucional')
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = now();

-- Inserir FAQs iniciais
INSERT INTO public.faq_training (question, answer, context, active) VALUES
  ('Como funciona o Feed?', 'O Feed é onde você vê todas as novidades da empresa: comunicados, treinamentos, campanhas e muito mais. Você pode curtir, comentar e interagir com os posts.', 'feed', true),
  ('Como funciona o sistema de Treinamentos?', 'No módulo Treinamentos você encontra vídeos, cursos e materiais de capacitação. Complete os treinamentos para ganhar certificados!', 'training', true),
  ('Como preencher um Checklist?', 'Os checklists são rotinas diárias. Acesse o módulo, selecione o checklist do dia e responda todas as perguntas. Algumas podem exigir fotos.', 'checklist', true),
  ('O que é o Mural?', 'O Mural é um espaço ANÔNIMO onde você pode compartilhar conquistas ou pedir ajuda. Suas mensagens são moderadas antes de aparecerem.', 'mural', true),
  ('Como submeter uma Ideia?', 'Vá em Ideias, clique em Nova Ideia, preencha título, descrição e categoria. Sua ideia será analisada e pode entrar em votação!', 'ideias', true)
ON CONFLICT DO NOTHING;

-- Trigger para atualizar updated_at em faq_training
CREATE OR REPLACE FUNCTION public.update_faq_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_faq_training_updated_at
  BEFORE UPDATE ON public.faq_training
  FOR EACH ROW
  EXECUTE FUNCTION public.update_faq_updated_at();