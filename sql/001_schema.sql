-- Active stream configuration
CREATE TABLE current_stream (
  id int PRIMARY KEY DEFAULT 1,
  playback_id text NOT NULL,
  title text NOT NULL,
  kind text CHECK (kind IN ('vod', 'live')) DEFAULT 'vod',
  updated_at timestamptz DEFAULT now(),
  updated_by text,
  CONSTRAINT single_row CHECK (id = 1)
);

-- Mux asset catalog
CREATE TABLE mux_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playback_id text UNIQUE NOT NULL,
  kind text CHECK (kind IN ('vod', 'live')),
  label text,
  duration_seconds int,
  created_at timestamptz DEFAULT now()
);

-- Chat messages
CREATE TABLE messages (
  id bigserial PRIMARY KEY,
  room text NOT NULL DEFAULT 'event',
  user_id text NOT NULL,
  user_name text NOT NULL,
  kind text CHECK (kind IN ('user', 'system', 'poll')) DEFAULT 'user',
  body text NOT NULL CHECK (length(body) <= 600),
  created_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX idx_messages_room_created ON messages(room, created_at DESC);

-- Polls
CREATE TABLE polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room text NOT NULL DEFAULT 'event',
  question text NOT NULL CHECK (length(question) <= 300),
  is_open boolean DEFAULT true,
  created_by text NOT NULL,
  created_at timestamptz DEFAULT now(),
  closed_at timestamptz
);

-- Poll options
CREATE TABLE poll_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid REFERENCES polls(id) ON DELETE CASCADE,
  label text NOT NULL CHECK (length(label) <= 100),
  idx int NOT NULL,
  UNIQUE (poll_id, idx)
);

-- Poll votes
CREATE TABLE poll_votes (
  poll_id uuid REFERENCES polls(id) ON DELETE CASCADE,
  option_id uuid REFERENCES poll_options(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  voted_at timestamptz DEFAULT now(),
  PRIMARY KEY (poll_id, user_id)
);

-- Chat rate limiting
CREATE TABLE chat_throttle (
  user_id text PRIMARY KEY,
  last_msg_at timestamptz NOT NULL
);

-- Admin audit log
CREATE TABLE admin_actions (
  id bigserial PRIMARY KEY,
  action_type text NOT NULL,
  admin_user text NOT NULL,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (read-only for now, will be enhanced in auth slice)
CREATE POLICY "Allow read access to all" ON messages
  FOR SELECT USING (true);

CREATE POLICY "Allow insert messages" ON messages
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow read access to all" ON polls
  FOR SELECT USING (true);

CREATE POLICY "Allow insert polls" ON polls
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update polls" ON polls
  FOR UPDATE USING (true);

CREATE POLICY "Allow read access to all" ON poll_options
  FOR SELECT USING (true);

CREATE POLICY "Allow insert poll_options" ON poll_options
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow read access to all" ON poll_votes
  FOR SELECT USING (true);

CREATE POLICY "Allow insert poll_votes" ON poll_votes
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update poll_votes" ON poll_votes
  FOR UPDATE USING (true);

-- Chat throttle policies
ALTER TABLE chat_throttle ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on chat_throttle" ON chat_throttle
  FOR ALL USING (true);

