-- Adicionar campos para rastreamento de origem externa no knowledge_base
ALTER TABLE public.knowledge_base
ADD COLUMN IF NOT EXISTS external_id TEXT,
ADD COLUMN IF NOT EXISTS external_source TEXT;

-- Criar índice para melhorar a performance de busca por external_id
CREATE INDEX IF NOT EXISTS idx_knowledge_base_external_id 
ON public.knowledge_base(external_id);

-- Adicionar campo notion_database_id nas settings se não existir
INSERT INTO public.settings (key, value, description)
VALUES ('notion_database_id', '""'::jsonb, 'ID do banco de dados do Notion para sincronização de manuais')
ON CONFLICT (key) DO NOTHING;

-- Comentário para documentação
COMMENT ON COLUMN public.knowledge_base.external_id IS 'ID do item na fonte externa (ex: Notion page ID)';
COMMENT ON COLUMN public.knowledge_base.external_source IS 'Origem do conteúdo (ex: notion, manual, etc)';