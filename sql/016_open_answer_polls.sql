-- Open-answer polls: instead of picking from admin-authored options,
-- viewers submit their own text answer (which becomes a new option anyone
-- can then vote for, including other viewers' submissions).

-- 'fixed' = today's behavior (admin authors 2-5 options up front).
-- 'open'  = viewers author the options themselves, no cap on how many.
ALTER TABLE polls ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'fixed';
ALTER TABLE polls DROP CONSTRAINT IF EXISTS polls_type_check;
ALTER TABLE polls ADD CONSTRAINT polls_type_check CHECK (type IN ('fixed', 'open'));

-- Tags who submitted an option. NULL for admin-authored fixed options.
ALTER TABLE poll_options ADD COLUMN IF NOT EXISTS author_user_id text;
ALTER TABLE poll_options ADD COLUMN IF NOT EXISTS author_name text;

-- Quotes run longer than the original 100-char fixed-choice label limit.
ALTER TABLE poll_options DROP CONSTRAINT IF EXISTS poll_options_label_check;
ALTER TABLE poll_options ADD CONSTRAINT poll_options_label_check CHECK (length(label) <= 280);

-- Realtime: broadcast newly submitted answers the same way votes already are,
-- so everyone sees new answers appear live without refreshing.
DROP TRIGGER IF EXISTS poll_options_broadcast_trigger ON public.poll_options;
CREATE TRIGGER poll_options_broadcast_trigger
  AFTER INSERT ON public.poll_options
  FOR EACH ROW EXECUTE FUNCTION public.table_broadcast_trigger();

ALTER PUBLICATION supabase_realtime ADD TABLE poll_options;

-- Seed the July 4th open-answer polls as closed drafts. Open each one from
-- the admin panel's Poll Management section when you're ready to run it —
-- see app/api/admin/polls/open/route.ts (new "Open" action added alongside
-- the existing Close).
INSERT INTO polls (room, question, type, is_open, created_by) VALUES
  ('event', 'What is your favorite Nic Cage quote?', 'open', false, 'admin-seed'),
  ('event', 'What is your favorite USA quote?', 'open', false, 'admin-seed'),
  ('event', 'Which Nic Cage film isn''t playing?', 'open', false, 'admin-seed'),
  ('event', 'What type of marathon are you hoping for next?', 'open', false, 'admin-seed'),
  ('event', 'Which actor do you think would be better at stealing the Declaration of Independence?', 'open', false, 'admin-seed'),
  ('event', 'What is the most American activity someone could be doing today?', 'open', false, 'admin-seed'),
  ('event', 'What is the top choice at the Ice Cream Truck?', 'open', false, 'admin-seed');
