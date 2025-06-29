/*
  # Fix current_time column naming conflict

  1. Changes
    - Rename current_time column to match_time to avoid PostgreSQL reserved keyword conflict
    - Update all references to use the new column name
    - Recreate functions with correct column references

  2. Security
    - Maintain existing RLS policies
    - Keep all existing constraints and indexes
*/

-- Drop existing function that references current_time
DROP FUNCTION IF EXISTS get_live_match_state(uuid);

-- Rename current_time column to match_time to avoid reserved keyword conflict
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'matches_live' AND column_name = 'current_time'
  ) THEN
    ALTER TABLE matches_live RENAME COLUMN current_time TO match_time;
  END IF;
END $$;

-- Update the time check constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'matches_live_time_check'
  ) THEN
    ALTER TABLE matches_live DROP CONSTRAINT matches_live_time_check;
  END IF;
END $$;

ALTER TABLE matches_live 
ADD CONSTRAINT matches_live_time_check 
CHECK (match_time >= 0);

-- Recreate function with correct column name
CREATE OR REPLACE FUNCTION get_live_match_state(match_uuid uuid)
RETURNS TABLE(
  match_id uuid,
  status text,
  current_quarter integer,
  match_time integer,
  home_score integer,
  away_score integer,
  updated_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ml.match_id,
    ml.status,
    ml.current_quarter,
    ml.match_time,
    ml.home_score,
    ml.away_score,
    ml.updated_at
  FROM matches_live ml
  WHERE ml.match_id = match_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on function
GRANT EXECUTE ON FUNCTION get_live_match_state(uuid) TO authenticated;

-- Add comment to document the fix
COMMENT ON COLUMN matches_live.match_time IS 'Current match time in seconds (renamed from current_time to avoid PostgreSQL reserved keyword conflict)';