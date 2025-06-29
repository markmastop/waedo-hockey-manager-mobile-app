/*
  # Create matches_live table for live match state tracking

  1. Changes
    - Create matches_live table to track live match state
    - Add foreign key constraint to matches table
    - Add indexes for better query performance
*/

-- Create matches_live table
CREATE TABLE IF NOT EXISTS matches_live (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (
    status IN ('upcoming', 'inProgress', 'paused', 'completed')
  ),
  current_quarter integer DEFAULT 1,
  home_score integer DEFAULT 0,
  away_score integer DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_matches_live_match_id ON matches_live(match_id);
CREATE INDEX IF NOT EXISTS idx_matches_live_status ON matches_live(status);

-- Add constraints for data integrity
ALTER TABLE matches_live 
ADD CONSTRAINT matches_live_quarter_check 
CHECK (current_quarter >= 1 AND current_quarter <= 4);

ALTER TABLE matches_live 
ADD CONSTRAINT matches_live_score_check 
CHECK (home_score >= 0 AND away_score >= 0);

-- Enable RLS
ALTER TABLE matches_live ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users to manage their team's matches
CREATE POLICY "Users can manage their team's matches"
  ON matches_live
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM matches m
      JOIN teams t ON m.team_id = t.id
      WHERE m.id = matches_live.match_id
      AND t.coach @> JSON_BUILD_ARRAY(JSON_BUILD_OBJECT('id', auth.uid()::text))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM matches m
      JOIN teams t ON m.team_id = t.id
      WHERE m.id = matches_live.match_id
      AND t.coach @> JSON_BUILD_ARRAY(JSON_BUILD_OBJECT('id', auth.uid()::text))
    )
  );

-- Add function to get live match state
CREATE OR REPLACE FUNCTION get_live_match_state(match_uuid uuid)
RETURNS TABLE(
  match_id uuid,
  status text,
  current_quarter integer,
  home_score integer,
  away_score integer,
  updated_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    match_id,
    status,
    current_quarter,
    home_score,
    away_score,
    updated_at
  FROM matches_live
  WHERE match_id = match_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on function
GRANT EXECUTE ON FUNCTION get_live_match_state(uuid) TO authenticated;

-- Add comment to document the table
COMMENT ON TABLE matches_live IS 'Tracks the live state of matches including current time, score, and status';
