-- Atualizar categorias do Mural para contexto de negócios
-- E adicionar suporte para imagens

-- 1. Recriar enum com categorias de negócio
DROP TYPE IF EXISTS mural_category CASCADE;

CREATE TYPE mural_category AS ENUM (
  'fornecedores',
  'eventos',
  'sistemas',
  'operacao',
  'compras',
  'juridico',
  'ideias'
);

-- 2. Recriar coluna category
ALTER TABLE mural_posts 
  DROP COLUMN IF EXISTS category CASCADE;

ALTER TABLE mural_posts
  ADD COLUMN category mural_category NOT NULL DEFAULT 'ideias';

-- 3. Adicionar coluna para imagem (se não existir)
ALTER TABLE mural_posts
  ADD COLUMN IF NOT EXISTS media_url TEXT;

-- 4. Adicionar índice para busca por categoria
CREATE INDEX IF NOT EXISTS idx_mural_posts_category ON mural_posts(category);

-- 5. Criar bucket de storage para imagens do mural (se não existir)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'mural-images',
  'mural-images',
  false, -- privado por padrão
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- 6. Policies de storage para o bucket mural-images
-- Usuários autenticados podem fazer upload
CREATE POLICY "Authenticated users can upload mural images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'mural-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Usuários podem visualizar suas próprias imagens e imagens de posts aprovados
CREATE POLICY "Users can view their own mural images"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'mural-images' AND
  (
    (storage.foldername(name))[1] = auth.uid()::text OR
    EXISTS (
      SELECT 1 FROM mural_posts
      WHERE media_url LIKE '%' || name || '%'
      AND status = 'approved'
    )
  )
);

-- Usuários podem deletar suas próprias imagens
CREATE POLICY "Users can delete own mural images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'mural-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 7. Comentários
COMMENT ON TYPE mural_category IS 'Categorias do Mural: Fornecedores, Eventos, Sistemas, Operação, Compras, Jurídico, Ideias';
COMMENT ON COLUMN mural_posts.media_url IS 'URL da imagem anexada ao post (opcional)';
COMMENT ON COLUMN mural_posts.category IS 'Categoria de negócio do pedido de ajuda';