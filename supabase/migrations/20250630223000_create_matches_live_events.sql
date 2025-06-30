/*
  # Create matches_live_events table for analytics

  1. Changes
    - Create matches_live_events table to store each match event in a row
    - Add indexes on match_id, (match_id, player_id) and metadata
    - Enable row level security and create basic policy

  2. Notes
    - Table is intended for post-match analysis
    - Metadata JSONB column allows flexible event details
*/

-- Create matches_live_events table
CREATE TABLE IF NOT EXISTS matches_live_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id uuid REFERENCES players(id),
  team_id uuid REFERENCES teams(id),
  action text NOT NULL,
  description text,
  match_time integer,
  quarter integer,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- Add indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_mle_match_id ON matches_live_events(match_id);
CREATE INDEX IF NOT EXISTS idx_mle_match_player ON matches_live_events(match_id, player_id);
CREATE INDEX IF NOT EXISTS idx_mle_metadata_gin ON matches_live_events USING GIN (metadata);

-- Enable RLS and basic policy mirroring matches_live
ALTER TABLE matches_live_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their team's events"
  ON matches_live_events
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM matches m
      JOIN teams t ON m.team_id = t.id
      WHERE m.id = matches_live_events.match_id
      AND t.coach @> JSON_BUILD_ARRAY(JSON_BUILD_OBJECT('id', auth.uid()::text))
    )
  );

-- Document the table
COMMENT ON TABLE matches_live_events IS 'Stores each live match event as a row for analytics';
