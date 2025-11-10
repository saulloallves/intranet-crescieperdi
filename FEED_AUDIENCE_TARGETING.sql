-- Segmentação de Audiência para Feed Posts
-- Execute este SQL no Supabase Dashboard > SQL Editor

-- Add audience targeting fields to feed_posts
ALTER TABLE feed_posts 
ADD COLUMN IF NOT EXISTS target_roles TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS target_units TEXT[] DEFAULT '{}';

-- Comment explaining the fields
COMMENT ON COLUMN feed_posts.target_roles IS 'Array of role IDs that can see this post. Empty array = visible to all';
COMMENT ON COLUMN feed_posts.target_units IS 'Array of unit names that can see this post. Empty array = visible to all';

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_feed_posts_target_roles ON feed_posts USING GIN (target_roles);
CREATE INDEX IF NOT EXISTS idx_feed_posts_target_units ON feed_posts USING GIN (target_units);

-- Update RLS policy to check audience targeting
DROP POLICY IF EXISTS "Anyone can view feed posts" ON feed_posts;

CREATE POLICY "Anyone can view feed posts based on audience"
ON feed_posts FOR SELECT
TO authenticated
USING (
  -- Post is visible to all (empty arrays)
  (array_length(target_roles, 1) IS NULL AND array_length(target_units, 1) IS NULL)
  OR
  -- User's role is in target_roles
  (target_roles && ARRAY[(SELECT role FROM profiles WHERE id = auth.uid())])
  OR
  -- User's unit is in target_units (future use)
  (target_units && ARRAY[(SELECT unit FROM profiles WHERE id = auth.uid())])
);
