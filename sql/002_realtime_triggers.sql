-- Broadcast Authorization Policy (Required for Realtime Broadcast)
-- This allows authenticated users to receive broadcast messages
CREATE POLICY "Allow authenticated users to receive broadcasts"
ON "realtime"."messages"
FOR SELECT
TO authenticated
USING (true);

-- Create helper function to broadcast changes
CREATE OR REPLACE FUNCTION public.broadcast_changes_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM realtime.broadcast_changes(
    TG_TABLE_SCHEMA || ':' || TG_TABLE_NAME || ':' || COALESCE((NEW.*)::text, (OLD.*)::text), -- placeholder topic, but we'll use table-based topic below
    TG_OP,
    TG_OP,
    TG_TABLE_NAME,
    TG_TABLE_SCHEMA,
    NEW,
    OLD
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- For clarity, create per-table trigger functions that set topic to table name (e.g., "messages")
CREATE OR REPLACE FUNCTION public.table_broadcast_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  topic text;
BEGIN
  -- Use topic as schema:table for broader subscriptions, or change as needed
  topic := TG_TABLE_SCHEMA || ':' || TG_TABLE_NAME;
  PERFORM realtime.broadcast_changes(
    topic,
    TG_OP,
    TG_OP,
    TG_TABLE_NAME,
    TG_TABLE_SCHEMA,
    NEW,
    OLD
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Drop existing triggers if they exist to make this idempotent
DROP TRIGGER IF EXISTS messages_broadcast_trigger ON public.messages;
CREATE TRIGGER messages_broadcast_trigger
  AFTER INSERT OR UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.table_broadcast_trigger();

DROP TRIGGER IF EXISTS current_stream_broadcast_trigger ON public.current_stream;
CREATE TRIGGER current_stream_broadcast_trigger
  AFTER UPDATE ON public.current_stream
  FOR EACH ROW EXECUTE FUNCTION public.table_broadcast_trigger();

DROP TRIGGER IF EXISTS polls_broadcast_trigger ON public.polls;
CREATE TRIGGER polls_broadcast_trigger
  AFTER INSERT OR UPDATE ON public.polls
  FOR EACH ROW EXECUTE FUNCTION public.table_broadcast_trigger();

DROP TRIGGER IF EXISTS poll_votes_broadcast_trigger ON public.poll_votes;
CREATE TRIGGER poll_votes_broadcast_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.poll_votes
  FOR EACH ROW EXECUTE FUNCTION public.table_broadcast_trigger();
