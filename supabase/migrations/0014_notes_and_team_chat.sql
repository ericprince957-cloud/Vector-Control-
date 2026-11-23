-- Personal/shared notes and a team group chat.
-- Staff can only read their own profile row, so display names are copied onto each
-- row by a SECURITY DEFINER trigger (clients cannot spoof them).

CREATE TABLE IF NOT EXISTS public.notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  owner_name text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '' CHECK (char_length(title) <= 200),
  body text NOT NULL DEFAULT '' CHECK (char_length(body) <= 20000),
  pinned boolean NOT NULL DEFAULT false,
  shared boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notes_owner_idx ON public.notes (owner_id, pinned DESC, updated_at DESC);
CREATE INDEX IF NOT EXISTS notes_shared_idx ON public.notes (updated_at DESC) WHERE shared;

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_name text NOT NULL DEFAULT '',
  sender_role text NOT NULL DEFAULT 'staff',
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_messages_created_idx ON public.chat_messages (created_at DESC);

CREATE OR REPLACE FUNCTION private.notes_before_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.owner_name := coalesce((SELECT nullif(full_name, '') FROM public.profiles WHERE id = NEW.owner_id), (SELECT email FROM public.profiles WHERE id = NEW.owner_id), '');
    NEW.created_at := now();
  ELSE
    NEW.owner_id := OLD.owner_id;
    NEW.owner_name := OLD.owner_name;
    NEW.created_at := OLD.created_at;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS notes_before_write ON public.notes;
CREATE TRIGGER notes_before_write BEFORE INSERT OR UPDATE ON public.notes
FOR EACH ROW EXECUTE FUNCTION private.notes_before_write();

CREATE OR REPLACE FUNCTION private.chat_before_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  SELECT coalesce(nullif(full_name, ''), email), role::text INTO NEW.sender_name, NEW.sender_role
  FROM public.profiles WHERE id = NEW.sender_id;
  NEW.body := btrim(NEW.body);
  NEW.created_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS chat_before_insert ON public.chat_messages;
CREATE TRIGGER chat_before_insert BEFORE INSERT ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION private.chat_before_insert();
REVOKE ALL ON FUNCTION private.notes_before_write() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.chat_before_insert() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notes, public.chat_messages FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notes TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.chat_messages TO authenticated;

-- Notes: private to the owner unless shared with the team. Only the owner edits; owner or founder deletes.
DROP POLICY IF EXISTS notes_select ON public.notes;
DROP POLICY IF EXISTS notes_insert ON public.notes;
DROP POLICY IF EXISTS notes_update ON public.notes;
DROP POLICY IF EXISTS notes_delete ON public.notes;
CREATE POLICY notes_select ON public.notes FOR SELECT TO authenticated
USING (private.is_active_user() AND (owner_id = (SELECT auth.uid()) OR shared));
CREATE POLICY notes_insert ON public.notes FOR INSERT TO authenticated
WITH CHECK (private.is_active_user() AND owner_id = (SELECT auth.uid()));
CREATE POLICY notes_update ON public.notes FOR UPDATE TO authenticated
USING (private.is_active_user() AND owner_id = (SELECT auth.uid()))
WITH CHECK (private.is_active_user() AND owner_id = (SELECT auth.uid()));
CREATE POLICY notes_delete ON public.notes FOR DELETE TO authenticated
USING (private.is_active_user() AND (owner_id = (SELECT auth.uid()) OR private.is_founder_user()));

-- Chat: every active team member can read and post; no editing; own messages (or founder) can be deleted.
DROP POLICY IF EXISTS chat_select ON public.chat_messages;
DROP POLICY IF EXISTS chat_insert ON public.chat_messages;
DROP POLICY IF EXISTS chat_delete ON public.chat_messages;
CREATE POLICY chat_select ON public.chat_messages FOR SELECT TO authenticated
USING (private.is_active_user());
CREATE POLICY chat_insert ON public.chat_messages FOR INSERT TO authenticated
WITH CHECK (private.is_active_user() AND sender_id = (SELECT auth.uid()));
CREATE POLICY chat_delete ON public.chat_messages FOR DELETE TO authenticated
USING (private.is_active_user() AND (sender_id = (SELECT auth.uid()) OR private.is_founder_user()));

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'chat_messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
  END IF;
END $$;
