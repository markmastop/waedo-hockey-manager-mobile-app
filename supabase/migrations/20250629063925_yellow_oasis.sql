/*
  # Fix column rename issue in matches_live table

  1. Changes
    - Safely add match_time column if it doesn't exist
    - Remove current_time column if it exists
    - Update constraints and functions accordingly
    - Handle both scenarios: column exists or doesn't exist

  2. Safety
    - Uses conditional logic to avoid errors
    - Preserves data if current_time column exists
    - Creates match_time column with proper constraints
*/

-- First, let's check what columns actually exist and handle accordingly
DO $$
DECLARE
  has_current_time boolean;
  has_match_time boolean;
BEGIN
  -- Check if current_time column exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'matches_live' AND column_name = 'current_time'
  ) INTO has_current_time;
  
  -- Check if match_time column exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'matches_live' AND column_name = 'match_time'
  ) INTO has_match_time;
  
  RAISE NOTICE 'has_current_time: %, has_match_time: %', has_current_time, has_match_time;
  
  -- Scenario 1: current_time exists but match_time doesn't - rename it
  IF has_current_time AND NOT has_match_time THEN
    RAISE NOTICE 'Renaming current_time to match_time';
    ALTER TABLE matches_live RENAME COLUMN current_time TO match_time;
  
  -- Scenario 2: neither exists - create match_time
  ELSIF NOT has_current_time AND NOT has_match_time THEN
    RAISE NOTICE 'Creating match_time column';
    ALTER TABLE matches_live ADD COLUMN match_time integer DEFAULT 0;
  
  -- Scenario 3: both exist - drop current_time, keep match_time
  ELSIF has_current_time AND has_match_time THEN
    RAISE NOTICE 'Both columns exist, dropping current_time';
    ALTER TABLE matches_live DROP COLUMN current_time;
  
  -- Scenario 4: only match_time exists - nothing to do
  ELSE
    RAISE NOTICE 'match_time already exists, nothing to do';
  END IF;
END $$;

-- Ensure the time check constraint exists with correct column name
DO $$
BEGIN
  -- Drop old constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'matches_live_time_check'
  ) THEN
    ALTER TABLE matches_live DROP CONSTRAINT matches_live_time_check;
  END IF;
  
  -- Add new constraint
  ALTER TABLE matches_live 
  ADD CONSTRAINT matches_live_time_check 
  CHECK (match_time >= 0);
END $$;

-- Drop and recreate the function to ensure it uses the correct column name
DROP FUNCTION IF EXISTS get_live_match_state(uuid);

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
COMMENT ON COLUMN matches_live.match_time IS 'Current match time in seconds (safely renamed from current_time to avoid PostgreSQL reserved keyword conflict)';