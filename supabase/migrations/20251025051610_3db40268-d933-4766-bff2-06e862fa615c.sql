-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create search_index table to store embeddings
CREATE TABLE public.search_index (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type TEXT NOT NULL, -- 'announcement', 'training', 'manual', 'checklist', 'idea'
  content_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB,
  embedding vector(768), -- Using 768 dimensions for text-embedding-3-small
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for vector similarity search
CREATE INDEX idx_search_embedding ON public.search_index USING ivfflat (embedding vector_cosine_ops);

-- Create index for content type filtering
CREATE INDEX idx_search_content_type ON public.search_index(content_type);

-- Create index for full-text search (fallback)
CREATE INDEX idx_search_content_fts ON public.search_index USING gin(to_tsvector('portuguese', title || ' ' || content));

-- Enable RLS
ALTER TABLE public.search_index ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Everyone can search"
  ON public.search_index FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage search index"
  ON public.search_index FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('admin', 'gestor_setor')
  ));

-- Create search_logs table for analytics
CREATE TABLE public.search_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  query TEXT NOT NULL,
  results_count INTEGER,
  filters JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.search_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create own search logs"
  ON public.search_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all search logs"
  ON public.search_logs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('admin', 'gestor_setor')
  ));