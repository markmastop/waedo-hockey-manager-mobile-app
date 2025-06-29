/*
  # Add score columns to matches_live table

  1. Changes
    - Add home_score and away_score columns to store current scores
    - Add constraints for data integrity
    - Add indexes for better query performance
*/

-- Add score columns
ALTER TABLE matches_live
ADD COLUMN IF NOT EXISTS home_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS away_score INTEGER DEFAULT 0;

-- Add check constraints for score integrity
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'matches_live_score_check'
  ) THEN
    ALTER TABLE matches_live 
    ADD CONSTRAINT matches_live_score_check 
    CHECK (home_score >= 0 AND away_score >= 0);
  END IF;
END $$;

-- Add indexes for score-related queries
CREATE INDEX IF NOT EXISTS idx_matches_live_scores 
ON matches_live(home_score, away_score);

-- Add function to get match score history
CREATE OR REPLACE FUNCTION get_match_score_history(match_uuid uuid)
RETURNS TABLE(
  match_id uuid,
  home_score integer,
  away_score integer,
  updated_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    match_id,
    home_score,
    away_score,
    updated_at
  FROM matches_live
  WHERE match_id = match_uuid
  ORDER BY updated_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on function
GRANT EXECUTE ON FUNCTION get_match_score_history(uuid) TO authenticated;

-- Add comment to document the changes
COMMENT ON TABLE matches_live IS 'Live match tracking with real-time scores and status updates';
