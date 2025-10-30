-- Enable Realtime for After Party using Postgres Changes (Publications)
-- This method works with anonymous users and is simpler for this use case
-- Reference: https://supabase.com/docs/guides/realtime/subscribing-to-database-changes#using-postgres-changes

BEGIN;

-- Remove the supabase_realtime publication if it exists
DROP PUBLICATION IF EXISTS supabase_realtime;

-- Re-create the supabase_realtime publication with no tables
CREATE PUBLICATION supabase_realtime;

COMMIT;

-- Add tables to the publication
-- These tables will broadcast INSERT, UPDATE, and DELETE events

-- Messages: For real-time chat
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Current stream: For stream switching updates
ALTER PUBLICATION supabase_realtime ADD TABLE current_stream;

-- Polls: For new polls and poll closures
ALTER PUBLICATION supabase_realtime ADD TABLE polls;

-- Poll votes: For live poll results
ALTER PUBLICATION supabase_realtime ADD TABLE poll_votes;

-- Verify the publication
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime';

