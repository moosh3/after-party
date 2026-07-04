-- Scene stamps for chat: where the movie was when a message was sent.
-- Nullable + additive, safe to run mid-event. Messages sent by clients on
-- older bundles simply have no stamp.
alter table messages add column if not exists playback_position numeric;
alter table messages add column if not exists playback_id text;
