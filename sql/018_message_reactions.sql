-- iMessage-style chat tapbacks.
-- Each viewer can leave one reaction per chat message.

CREATE TABLE IF NOT EXISTS message_reactions (
  message_id bigint NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  user_name text NOT NULL,
  reaction text NOT NULL CHECK (
    reaction IN ('love', 'like', 'dislike', 'haha', 'emphasize', 'question')
  ),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id
  ON message_reactions(message_id);

ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read access to all" ON message_reactions;
CREATE POLICY "Allow read access to all" ON message_reactions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert reactions" ON message_reactions;
CREATE POLICY "Allow insert reactions" ON message_reactions
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update own reactions" ON message_reactions;
CREATE POLICY "Allow update own reactions" ON message_reactions
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow delete own reactions" ON message_reactions;
CREATE POLICY "Allow delete own reactions" ON message_reactions
  FOR DELETE USING (true);

CREATE OR REPLACE FUNCTION public.set_message_reaction_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS message_reactions_updated_at_trigger ON message_reactions;
CREATE TRIGGER message_reactions_updated_at_trigger
  BEFORE UPDATE ON message_reactions
  FOR EACH ROW EXECUTE FUNCTION public.set_message_reaction_updated_at();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1
       FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'message_reactions'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
  END IF;
END $$;
