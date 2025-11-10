-- Create enums if they don't exist
DO $$ BEGIN
  CREATE TYPE approval_source AS ENUM ('ai', 'manual');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE mural_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create mural_posts table
CREATE TABLE IF NOT EXISTS public.mural_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  content_clean TEXT,
  category mural_category NOT NULL,
  status mural_status NOT NULL DEFAULT 'pending',
  ai_reason TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  approval_source approval_source,
  media_url TEXT,
  response_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  approved_at TIMESTAMP WITH TIME ZONE
);

-- Create mural_responses table
CREATE TABLE IF NOT EXISTS public.mural_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.mural_posts(id) ON DELETE CASCADE,
  responder_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  content_clean TEXT,
  status mural_status NOT NULL DEFAULT 'pending',
  ai_reason TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  approval_source approval_source,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  approved_at TIMESTAMP WITH TIME ZONE
);

-- Create mural_settings table
CREATE TABLE IF NOT EXISTS public.mural_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_mural_posts_author ON public.mural_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_mural_posts_status ON public.mural_posts(status);
CREATE INDEX IF NOT EXISTS idx_mural_posts_category ON public.mural_posts(category);
CREATE INDEX IF NOT EXISTS idx_mural_posts_created ON public.mural_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mural_responses_post ON public.mural_responses(post_id);
CREATE INDEX IF NOT EXISTS idx_mural_responses_responder ON public.mural_responses(responder_id);
CREATE INDEX IF NOT EXISTS idx_mural_responses_status ON public.mural_responses(status);
CREATE INDEX IF NOT EXISTS idx_mural_responses_created ON public.mural_responses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mural_settings_key ON public.mural_settings(key);

-- Enable RLS
ALTER TABLE public.mural_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mural_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mural_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view approved posts" ON public.mural_posts;
DROP POLICY IF EXISTS "Users can create own posts" ON public.mural_posts;
DROP POLICY IF EXISTS "Admins can view all posts" ON public.mural_posts;
DROP POLICY IF EXISTS "Admins can update posts" ON public.mural_posts;
DROP POLICY IF EXISTS "Admins can delete posts" ON public.mural_posts;

DROP POLICY IF EXISTS "Users can view approved responses" ON public.mural_responses;
DROP POLICY IF EXISTS "Users can create own responses" ON public.mural_responses;
DROP POLICY IF EXISTS "Admins can view all responses" ON public.mural_responses;
DROP POLICY IF EXISTS "Admins can update responses" ON public.mural_responses;
DROP POLICY IF EXISTS "Admins can delete responses" ON public.mural_responses;

DROP POLICY IF EXISTS "Everyone can view mural settings" ON public.mural_settings;
DROP POLICY IF EXISTS "Only admins can manage mural settings" ON public.mural_settings;

-- RLS Policies for mural_posts
CREATE POLICY "Users can view approved posts"
  ON public.mural_posts FOR SELECT
  USING (status = 'approved');

CREATE POLICY "Users can create own posts"
  ON public.mural_posts FOR INSERT
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Admins can view all posts"
  ON public.mural_posts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update posts"
  ON public.mural_posts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete posts"
  ON public.mural_posts FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for mural_responses
CREATE POLICY "Users can view approved responses"
  ON public.mural_responses FOR SELECT
  USING (status = 'approved');

CREATE POLICY "Users can create own responses"
  ON public.mural_responses FOR INSERT
  WITH CHECK (auth.uid() = responder_id);

CREATE POLICY "Admins can view all responses"
  ON public.mural_responses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update responses"
  ON public.mural_responses FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete responses"
  ON public.mural_responses FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for mural_settings
CREATE POLICY "Everyone can view mural settings"
  ON public.mural_settings FOR SELECT
  USING (true);

CREATE POLICY "Only admins can manage mural settings"
  ON public.mural_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Create or replace function to update updated_at
CREATE OR REPLACE FUNCTION public.update_mural_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create or replace function to update response count
CREATE OR REPLACE FUNCTION public.update_mural_response_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'approved' THEN
    UPDATE public.mural_posts
    SET response_count = response_count + 1
    WHERE id = NEW.post_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.status != 'approved' AND NEW.status = 'approved' THEN
    UPDATE public.mural_posts
    SET response_count = response_count + 1
    WHERE id = NEW.post_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'approved' AND NEW.status != 'approved' THEN
    UPDATE public.mural_posts
    SET response_count = GREATEST(0, response_count - 1)
    WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' AND OLD.status = 'approved' THEN
    UPDATE public.mural_posts
    SET response_count = GREATEST(0, response_count - 1)
    WHERE id = OLD.post_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_mural_posts_updated_at ON public.mural_posts;
DROP TRIGGER IF EXISTS update_mural_responses_updated_at ON public.mural_responses;
DROP TRIGGER IF EXISTS update_mural_settings_updated_at ON public.mural_settings;
DROP TRIGGER IF EXISTS update_mural_posts_response_count ON public.mural_responses;

-- Create triggers
CREATE TRIGGER update_mural_posts_updated_at
  BEFORE UPDATE ON public.mural_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_mural_updated_at();

CREATE TRIGGER update_mural_responses_updated_at
  BEFORE UPDATE ON public.mural_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_mural_updated_at();

CREATE TRIGGER update_mural_settings_updated_at
  BEFORE UPDATE ON public.mural_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_mural_updated_at();

CREATE TRIGGER update_mural_posts_response_count
  AFTER INSERT OR UPDATE OR DELETE ON public.mural_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_mural_response_count();

-- Insert default settings (only if they don't exist)
INSERT INTO public.mural_settings (key, value, description)
VALUES
  ('ai_moderation_enabled', '{"enabled": true}'::jsonb, 'Enable AI content moderation'),
  ('auto_approve_threshold', '{"score": 0.8}'::jsonb, 'Auto-approve content above this confidence score'),
  ('forbidden_words', '{"words": []}'::jsonb, 'List of forbidden words'),
  ('categories_enabled', '{"duvida": true, "sugestao": true, "elogio": true, "reclamacao": true}'::jsonb, 'Enabled categories'),
  ('max_posts_per_day', '{"limit": 5}'::jsonb, 'Maximum posts per user per day'),
  ('require_approval', '{"enabled": true}'::jsonb, 'Require admin approval for posts'),
  ('notification_email', '{"email": "admin@example.com"}'::jsonb, 'Email for moderation notifications'),
  ('allow_responses', '{"enabled": true}'::jsonb, 'Allow users to respond to posts')
ON CONFLICT (key) DO NOTHING;