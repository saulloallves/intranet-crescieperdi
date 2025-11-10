-- Corrigir enum mural_category para as categorias corretas do Mural Cresci e Perdi
-- Primeiro, remover o enum antigo e criar o novo

-- Drop enum antigo e criar novo com as categorias corretas
DROP TYPE IF EXISTS mural_category CASCADE;

CREATE TYPE mural_category AS ENUM (
  'celebracao',
  'reflexao',
  'gratidao',
  'conquista',
  'desabafo'
);

-- Recriar coluna category na tabela mural_posts com o novo enum
ALTER TABLE mural_posts 
  DROP COLUMN IF EXISTS category CASCADE;

ALTER TABLE mural_posts
  ADD COLUMN category mural_category NOT NULL DEFAULT 'desabafo';

-- Adicionar comentário explicativo
COMMENT ON TYPE mural_category IS 'Categorias do Mural Cresci e Perdi: celebração, reflexão, gratidão, conquista e desabafo';
COMMENT ON COLUMN mural_posts.category IS 'Categoria do post no Mural Cresci e Perdi';