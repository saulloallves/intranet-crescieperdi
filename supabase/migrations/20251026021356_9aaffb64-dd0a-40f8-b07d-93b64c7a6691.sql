-- Create feed_posts table for unified institutional feed
CREATE TABLE IF NOT EXISTS public.feed_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL, -- 'training', 'checklist', 'manual', 'campaign', 'recognition', 'idea', 'media', 'survey', 'announcement'
  title text NOT NULL,
  description text NOT NULL,
  module_link text,
  media_url text,
  reference_id uuid, -- ID of the related content in its original table
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  audience_roles user_role[],
  audience_units text[],
  pinned boolean DEFAULT false,
  likes_count integer DEFAULT 0,
  comments_count integer DEFAULT 0
);

-- Create feed_likes table
CREATE TABLE IF NOT EXISTS public.feed_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES public.feed_posts(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  reaction text DEFAULT 'like', -- 'like', 'heart', 'fire', 'clap'
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(post_id, user_id)
);

-- Create feed_comments table
CREATE TABLE IF NOT EXISTS public.feed_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES public.feed_posts(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  comment text NOT NULL CHECK (char_length(comment) <= 280),
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.feed_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for feed_posts
CREATE POLICY "Users can view posts based on their role and unit"
  ON public.feed_posts FOR SELECT
  USING (
    audience_roles IS NULL OR
    audience_units IS NULL OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (
        profiles.role = ANY(audience_roles) OR
        profiles.unit_code = ANY(audience_units) OR
        audience_roles = '{}'::user_role[] OR
        audience_units = '{}'::text[]
      )
    )
  );

CREATE POLICY "Admins can manage all posts"
  ON public.feed_posts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = ANY(ARRAY['admin'::user_role, 'gestor_setor'::user_role])
    )
  );

-- RLS Policies for feed_likes
CREATE POLICY "Users can view all likes"
  ON public.feed_likes FOR SELECT
  USING (true);

CREATE POLICY "Users can manage own likes"
  ON public.feed_likes FOR ALL
  USING (user_id = auth.uid());

-- RLS Policies for feed_comments
CREATE POLICY "Users can view all comments"
  ON public.feed_comments FOR SELECT
  USING (true);

CREATE POLICY "Users can create comments"
  ON public.feed_comments FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own comments"
  ON public.feed_comments FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "Admins can delete any comment"
  ON public.feed_comments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = ANY(ARRAY['admin'::user_role, 'gestor_setor'::user_role])
    )
  );

-- Create indexes for performance
CREATE INDEX idx_feed_posts_created_at ON public.feed_posts(created_at DESC);
CREATE INDEX idx_feed_posts_type ON public.feed_posts(type);
CREATE INDEX idx_feed_posts_pinned ON public.feed_posts(pinned) WHERE pinned = true;
CREATE INDEX idx_feed_likes_post_id ON public.feed_likes(post_id);
CREATE INDEX idx_feed_comments_post_id ON public.feed_comments(post_id);

-- Create trigger to update likes_count
CREATE OR REPLACE FUNCTION update_feed_post_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.feed_posts 
    SET likes_count = likes_count + 1 
    WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.feed_posts 
    SET likes_count = GREATEST(0, likes_count - 1) 
    WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER feed_likes_count_trigger
AFTER INSERT OR DELETE ON public.feed_likes
FOR EACH ROW
EXECUTE FUNCTION update_feed_post_likes_count();

-- Create trigger to update comments_count
CREATE OR REPLACE FUNCTION update_feed_post_comments_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.feed_posts 
    SET comments_count = comments_count + 1 
    WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.feed_posts 
    SET comments_count = GREATEST(0, comments_count - 1) 
    WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER feed_comments_count_trigger
AFTER INSERT OR DELETE ON public.feed_comments
FOR EACH ROW
EXECUTE FUNCTION update_feed_post_comments_count();

-- Insert automation settings for feed
INSERT INTO public.automation_settings (key, value, description)
VALUES 
  ('feed_auto_publish', '{"enabled": true}'::jsonb, 'Automatically publish events to feed'),
  ('feed_like_enabled', '{"enabled": true}'::jsonb, 'Enable like system'),
  ('feed_comment_enabled', '{"enabled": true}'::jsonb, 'Enable comments'),
  ('feed_highlight_threshold', '{"count": 10}'::jsonb, 'Minimum likes for highlight'),
  ('feed_zapi_critical_types', '{"types": ["announcement", "campaign", "checklist"]}'::jsonb, 'Post types that trigger WhatsApp notification'),
  ('feed_summary_frequency', '{"frequency": "weekly"}'::jsonb, 'AI summary generation frequency')
ON CONFLICT (key) DO NOTHING;