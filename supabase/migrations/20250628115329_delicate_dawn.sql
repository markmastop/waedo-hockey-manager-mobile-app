/*
  # Add matches_live_events table for comprehensive match logging

  1. New Tables
    - `matches_live_events`
      - `id` (uuid, primary key)
      - `match_id` (uuid, foreign key to matches)
      - `player_id` (uuid, references player in match data)
      - `action` (text, e.g., 'swap', 'goal', 'card', 'substitution')
      - `description` (text, detailed description of the action)
      - `match_time` (integer, time in seconds when action occurred)
      - `quarter` (integer, quarter when action occurred)
      - `metadata` (jsonb, additional data like positions, scores, etc.)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `matches_live_events` table
    - Add policy for authenticated users to read/write events for their team matches

  3. Indexes
    - Add indexes for efficient querying by match_id and action type
*/

-- Create matches_live_events table
CREATE TABLE IF NOT EXISTS matches_live_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id text, -- Store as text since players are stored as JSON in matches
  action text NOT NULL,
  description text NOT NULL,
  match_time integer DEFAULT 0,
  quarter integer DEFAULT 1,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE matches_live_events ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users to manage events for their team matches
CREATE POLICY "Users can manage events for their team matches"
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
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM matches m
      JOIN teams t ON m.team_id = t.id
      WHERE m.id = matches_live_events.match_id
      AND t.coach @> JSON_BUILD_ARRAY(JSON_BUILD_OBJECT('id', auth.uid()::text))
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_matches_live_events_match_id ON matches_live_events(match_id);
CREATE INDEX IF NOT EXISTS idx_matches_live_events_action ON matches_live_events(action);
CREATE INDEX IF NOT EXISTS idx_matches_live_events_created_at ON matches_live_events(created_at);
CREATE INDEX IF NOT EXISTS idx_matches_live_events_match_time ON matches_live_events(match_time);

-- Add comment to document the table
COMMENT ON TABLE matches_live_events IS 'Comprehensive logging of all match events including swaps, goals, cards, and other actions';