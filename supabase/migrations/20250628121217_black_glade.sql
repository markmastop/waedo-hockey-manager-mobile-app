/*
  # Complete setup for matches_live_events table

  1. New Tables
    - `matches_live_events`
      - `id` (uuid, primary key)
      - `match_id` (uuid, foreign key to matches)
      - `player_id` (text, references player in match data)
      - `action` (text, comprehensive list of event types)
      - `description` (text, detailed description of the action)
      - `match_time` (integer, time in seconds when action occurred)
      - `quarter` (integer, quarter when action occurred)
      - `metadata` (jsonb, additional data like positions, scores, etc.)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `matches_live_events` table
    - Add policy for authenticated users to read/write events for their team matches

  3. Indexes
    - Add comprehensive indexes for efficient querying
    - Composite indexes for common query patterns

  4. Functions
    - get_match_events_summary: Get summary of events by action type
    - get_player_event_stats: Get player-specific event statistics

  5. Constraints
    - Valid action types
    - Valid quarter values (1-4)
    - Non-negative match time
*/

-- Drop table if it exists to ensure clean creation
DROP TABLE IF EXISTS matches_live_events CASCADE;

-- Create matches_live_events table
CREATE TABLE matches_live_events (
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

-- Add check constraints for data integrity
ALTER TABLE matches_live_events 
ADD CONSTRAINT matches_live_events_action_check 
CHECK (action IN (
  'swap', 'goal', 'card', 'substitution', 
  'match_start', 'match_end', 'quarter_start', 'quarter_end', 
  'formation_change', 'player_selection', 'timeout', 'injury',
  'penalty_corner', 'penalty_stroke', 'green_card', 'yellow_card', 'red_card',
  'score_change'
));

ALTER TABLE matches_live_events 
ADD CONSTRAINT matches_live_events_quarter_check 
CHECK (quarter >= 1 AND quarter <= 4);

ALTER TABLE matches_live_events 
ADD CONSTRAINT matches_live_events_match_time_check 
CHECK (match_time >= 0);

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

-- Create comprehensive indexes for better performance
CREATE INDEX idx_matches_live_events_match_id ON matches_live_events(match_id);
CREATE INDEX idx_matches_live_events_action ON matches_live_events(action);
CREATE INDEX idx_matches_live_events_created_at ON matches_live_events(created_at);
CREATE INDEX idx_matches_live_events_match_time ON matches_live_events(match_time);

-- Create composite indexes for common query patterns
CREATE INDEX idx_matches_live_events_match_action_time 
ON matches_live_events(match_id, action, match_time);

CREATE INDEX idx_matches_live_events_match_quarter_time 
ON matches_live_events(match_id, quarter, match_time);

CREATE INDEX idx_matches_live_events_player_action 
ON matches_live_events(player_id, action) 
WHERE player_id IS NOT NULL;

-- Create partial index for recent events (last 24 hours)
CREATE INDEX idx_matches_live_events_recent 
ON matches_live_events(match_id, created_at) 
WHERE created_at > (NOW() - INTERVAL '24 hours');

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS get_match_events_summary(uuid);
DROP FUNCTION IF EXISTS get_player_event_stats(uuid, text);

-- Add function to get match events summary
CREATE OR REPLACE FUNCTION get_match_events_summary(match_uuid uuid)
RETURNS TABLE(
  action_type text,
  event_count bigint,
  first_occurrence timestamptz,
  last_occurrence timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mle.action as action_type,
    COUNT(*) as event_count,
    MIN(mle.created_at) as first_occurrence,
    MAX(mle.created_at) as last_occurrence
  FROM matches_live_events mle
  WHERE mle.match_id = match_uuid
  GROUP BY mle.action
  ORDER BY event_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add function to get player event statistics
CREATE OR REPLACE FUNCTION get_player_event_stats(match_uuid uuid, player_uuid text)
RETURNS TABLE(
  action_type text,
  event_count bigint,
  avg_match_time numeric,
  quarters_active integer[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mle.action as action_type,
    COUNT(*) as event_count,
    AVG(mle.match_time) as avg_match_time,
    ARRAY_AGG(DISTINCT mle.quarter ORDER BY mle.quarter) as quarters_active
  FROM matches_live_events mle
  WHERE mle.match_id = match_uuid 
    AND mle.player_id = player_uuid
  GROUP BY mle.action
  ORDER BY event_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on functions to authenticated users
GRANT EXECUTE ON FUNCTION get_match_events_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_player_event_stats(uuid, text) TO authenticated;

-- Add comment to document the table
COMMENT ON TABLE matches_live_events IS 'Complete comprehensive logging of all match events including swaps, goals, cards, and other actions with optimized indexing and validation';