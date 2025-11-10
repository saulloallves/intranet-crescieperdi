-- Create support tickets table
CREATE TABLE public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  typebot_result_id TEXT UNIQUE,
  user_id UUID REFERENCES auth.users(id),
  user_name TEXT,
  user_email TEXT,
  subject TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT DEFAULT 'medium',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- Create girabot interactions table
CREATE TABLE public.girabot_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  typebot_result_id TEXT UNIQUE,
  user_id UUID REFERENCES auth.users(id),
  user_name TEXT,
  question TEXT NOT NULL,
  answer TEXT,
  category TEXT,
  helpful BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create media requests table
CREATE TABLE public.media_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  typebot_result_id TEXT UNIQUE,
  user_id UUID REFERENCES auth.users(id),
  user_name TEXT,
  user_email TEXT,
  request_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  deadline DATE,
  status TEXT NOT NULL DEFAULT 'pending',
  media_urls JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.girabot_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for support_tickets
CREATE POLICY "Users can view own tickets"
  ON public.support_tickets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own tickets"
  ON public.support_tickets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all tickets"
  ON public.support_tickets FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('admin', 'gestor_setor')
  ));

-- RLS Policies for girabot_interactions
CREATE POLICY "Users can view own interactions"
  ON public.girabot_interactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own interactions"
  ON public.girabot_interactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all interactions"
  ON public.girabot_interactions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('admin', 'gestor_setor')
  ));

-- RLS Policies for media_requests
CREATE POLICY "Users can view own media requests"
  ON public.media_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own media requests"
  ON public.media_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all media requests"
  ON public.media_requests FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('admin', 'gestor_setor')
  ));

-- Create indexes for better performance
CREATE INDEX idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX idx_support_tickets_user_id ON public.support_tickets(user_id);
CREATE INDEX idx_girabot_interactions_user_id ON public.girabot_interactions(user_id);
CREATE INDEX idx_media_requests_status ON public.media_requests(status);
CREATE INDEX idx_media_requests_user_id ON public.media_requests(user_id);