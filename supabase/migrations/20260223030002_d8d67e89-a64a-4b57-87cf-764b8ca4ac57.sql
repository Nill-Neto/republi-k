
-- =====================
-- BULLETIN POSTS (Mural de Avisos)
-- =====================
CREATE TABLE public.bulletin_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bulletin_posts ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_bulletin_posts_updated_at
  BEFORE UPDATE ON public.bulletin_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Members can view bulletin posts"
  ON public.bulletin_posts FOR SELECT
  USING (is_member_of_group(auth.uid(), group_id));

CREATE POLICY "Members can create bulletin posts"
  ON public.bulletin_posts FOR INSERT
  WITH CHECK (is_member_of_group(auth.uid(), group_id) AND created_by = auth.uid());

CREATE POLICY "Creator or admin can update posts"
  ON public.bulletin_posts FOR UPDATE
  USING (created_by = auth.uid() OR has_role_in_group(auth.uid(), group_id, 'admin'));

CREATE POLICY "Creator or admin can delete posts"
  ON public.bulletin_posts FOR DELETE
  USING (created_by = auth.uid() OR has_role_in_group(auth.uid(), group_id, 'admin'));

-- =====================
-- HOUSE RULES (Regras de Convivência)
-- =====================
CREATE TABLE public.house_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  title text NOT NULL,
  description text,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.house_rules ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_house_rules_updated_at
  BEFORE UPDATE ON public.house_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Members can view house rules"
  ON public.house_rules FOR SELECT
  USING (is_member_of_group(auth.uid(), group_id));

CREATE POLICY "Admin can create house rules"
  ON public.house_rules FOR INSERT
  WITH CHECK (has_role_in_group(auth.uid(), group_id, 'admin'));

CREATE POLICY "Admin can update house rules"
  ON public.house_rules FOR UPDATE
  USING (has_role_in_group(auth.uid(), group_id, 'admin'));

CREATE POLICY "Admin can delete house rules"
  ON public.house_rules FOR DELETE
  USING (has_role_in_group(auth.uid(), group_id, 'admin'));

-- =====================
-- POLLS (Votações)
-- =====================
CREATE TABLE public.polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  question text NOT NULL,
  description text,
  multiple_choice boolean NOT NULL DEFAULT false,
  anonymous boolean NOT NULL DEFAULT false,
  closes_at timestamptz,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_polls_updated_at
  BEFORE UPDATE ON public.polls
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Members can view polls"
  ON public.polls FOR SELECT
  USING (is_member_of_group(auth.uid(), group_id));

CREATE POLICY "Members can create polls"
  ON public.polls FOR INSERT
  WITH CHECK (is_member_of_group(auth.uid(), group_id) AND created_by = auth.uid());

CREATE POLICY "Creator or admin can update polls"
  ON public.polls FOR UPDATE
  USING (created_by = auth.uid() OR has_role_in_group(auth.uid(), group_id, 'admin'));

CREATE POLICY "Creator or admin can delete polls"
  ON public.polls FOR DELETE
  USING (created_by = auth.uid() OR has_role_in_group(auth.uid(), group_id, 'admin'));

-- =====================
-- POLL OPTIONS
-- =====================
CREATE TABLE public.poll_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  label text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view poll options"
  ON public.poll_options FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.polls p WHERE p.id = poll_options.poll_id AND is_member_of_group(auth.uid(), p.group_id)
  ));

CREATE POLICY "Poll creator can manage options"
  ON public.poll_options FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.polls p WHERE p.id = poll_options.poll_id
      AND (p.created_by = auth.uid() OR has_role_in_group(auth.uid(), p.group_id, 'admin'))
  ));

CREATE POLICY "Poll creator can delete options"
  ON public.poll_options FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.polls p WHERE p.id = poll_options.poll_id
      AND (p.created_by = auth.uid() OR has_role_in_group(auth.uid(), p.group_id, 'admin'))
  ));

-- =====================
-- POLL VOTES
-- =====================
CREATE TABLE public.poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES public.poll_options(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(poll_id, option_id, user_id)
);

ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view poll votes"
  ON public.poll_votes FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.polls p WHERE p.id = poll_votes.poll_id AND is_member_of_group(auth.uid(), p.group_id)
  ));

CREATE POLICY "Members can vote"
  ON public.poll_votes FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.polls p WHERE p.id = poll_votes.poll_id
        AND is_member_of_group(auth.uid(), p.group_id) AND p.status = 'open'
    )
  );

CREATE POLICY "Users can remove own votes"
  ON public.poll_votes FOR DELETE
  USING (user_id = auth.uid());
