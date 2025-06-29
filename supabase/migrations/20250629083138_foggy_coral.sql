/*
  # Fix events column existence error

  1. Changes
    - Ensure events and last_event columns exist in matches_live table
    - Add proper constraints and indexes
    - Fix any column naming issues
    - Ensure all functions work correctly

  2. Safety
    - Use IF NOT EXISTS to prevent errors if columns already exist
    - Handle both scenarios: column exists or doesn't exist
    - Maintain data integrity
*/

-- Ensure the events column exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'matches_live' AND column_name = 'events'
  ) THEN
    ALTER TABLE matches_live ADD COLUMN events JSONB DEFAULT '[]'::jsonb;
    COMMENT ON COLUMN matches_live.events IS 'Array of all match events stored as JSONB';
    RAISE NOTICE 'Added events column to matches_live table';
  ELSE
    RAISE NOTICE 'Events column already exists in matches_live table';
  END IF;
END $$;

-- Ensure the last_event column exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'matches_live' AND column_name = 'last_event'
  ) THEN
    ALTER TABLE matches_live ADD COLUMN last_event JSONB;
    COMMENT ON COLUMN matches_live.last_event IS 'Most recent match event for quick access in live environment';
    RAISE NOTICE 'Added last_event column to matches_live table';
  ELSE
    RAISE NOTICE 'Last_event column already exists in matches_live table';
  END IF;
END $$;

-- Ensure match_key column exists and is nullable
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'matches_live' AND column_name = 'match_key'
  ) THEN
    ALTER TABLE matches_live ADD COLUMN match_key TEXT;
    COMMENT ON COLUMN matches_live.match_key IS 'Match key identifier from the original match';
    RAISE NOTICE 'Added match_key column to matches_live table';
  ELSE
    -- Ensure it's nullable
    ALTER TABLE matches_live ALTER COLUMN match_key DROP NOT NULL;
    RAISE NOTICE 'Match_key column already exists, ensured it is nullable';
  END IF;
END $$;

-- Ensure home_team and away_team columns exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'matches_live' AND column_name = 'home_team'
  ) THEN
    ALTER TABLE matches_live ADD COLUMN home_team TEXT NOT NULL DEFAULT '';
    COMMENT ON COLUMN matches_live.home_team IS 'Home team name';
    RAISE NOTICE 'Added home_team column to matches_live table';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'matches_live' AND column_name = 'away_team'
  ) THEN
    ALTER TABLE matches_live ADD COLUMN away_team TEXT NOT NULL DEFAULT '';
    COMMENT ON COLUMN matches_live.away_team IS 'Away team name';
    RAISE NOTICE 'Added away_team column to matches_live table';
  END IF;
END $$;

-- Ensure club_logo_url column exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'matches_live' AND column_name = 'club_logo_url'
  ) THEN
    ALTER TABLE matches_live ADD COLUMN club_logo_url TEXT;
    COMMENT ON COLUMN matches_live.club_logo_url IS 'URL to the club/team logo image';
    RAISE NOTICE 'Added club_logo_url column to matches_live table';
  END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_matches_live_events_gin 
ON matches_live USING GIN (events);

CREATE INDEX IF NOT EXISTS idx_matches_live_last_event_gin 
ON matches_live USING GIN (last_event);

CREATE INDEX IF NOT EXISTS idx_matches_live_match_key 
ON matches_live (match_key);

CREATE INDEX IF NOT EXISTS idx_matches_live_home_team 
ON matches_live (home_team);

CREATE INDEX IF NOT EXISTS idx_matches_live_away_team 
ON matches_live (away_team);

-- Update existing records to have empty events array if NULL
UPDATE matches_live 
SET events = '[]'::jsonb 
WHERE events IS NULL;

-- Recreate the add_match_event function to ensure it works correctly
CREATE OR REPLACE FUNCTION add_match_event(
  match_uuid uuid,
  event_data jsonb
) RETURNS boolean AS $$
DECLARE
  event_with_timestamp jsonb;
  rows_affected integer;
BEGIN
  -- Validate input
  IF match_uuid IS NULL OR event_data IS NULL THEN
    RAISE NOTICE 'Invalid input: match_uuid or event_data is NULL';
    RETURN false;
  END IF;

  -- Add timestamp and ensure event has an ID
  event_with_timestamp := event_data || jsonb_build_object(
    'timestamp', now(),
    'id', COALESCE(event_data->>'id', gen_random_uuid()::text)
  );
  
  -- Update the matches_live record
  UPDATE matches_live 
  SET 
    events = COALESCE(events, '[]'::jsonb) || jsonb_build_array(event_with_timestamp),
    last_event = event_with_timestamp,
    updated_at = now()
  WHERE match_id = match_uuid;
  
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  
  -- If no rows were affected, the match_id doesn't exist
  IF rows_affected = 0 THEN
    RAISE NOTICE 'No matches_live record found for match_id: %', match_uuid;
    RETURN false;
  END IF;
  
  RAISE NOTICE 'Successfully added event to match %', match_uuid;
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate other functions to ensure they work correctly
CREATE OR REPLACE FUNCTION get_recent_match_events(
  match_uuid uuid,
  event_limit integer DEFAULT 10
) RETURNS jsonb AS $$
DECLARE
  match_events jsonb;
  recent_events jsonb;
BEGIN
  -- Validate input
  IF match_uuid IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  -- Get the events array from matches_live
  SELECT COALESCE(events, '[]'::jsonb) INTO match_events
  FROM matches_live
  WHERE match_id = match_uuid;
  
  -- If no match found, return empty array
  IF match_events IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;
  
  -- Get the most recent events (events are stored chronologically)
  SELECT jsonb_agg(event)
  INTO recent_events
  FROM (
    SELECT value as event
    FROM jsonb_array_elements(match_events)
    ORDER BY (value->>'timestamp')::timestamptz DESC
    LIMIT event_limit
  ) sub;
  
  RETURN COALESCE(recent_events, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_match_events_by_action(
  match_uuid uuid,
  action_type text
) RETURNS jsonb AS $$
DECLARE
  match_events jsonb;
  filtered_events jsonb;
BEGIN
  -- Validate input
  IF match_uuid IS NULL OR action_type IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  -- Get the events array from matches_live
  SELECT COALESCE(events, '[]'::jsonb) INTO match_events
  FROM matches_live
  WHERE match_id = match_uuid;
  
  -- If no match found, return empty array
  IF match_events IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;
  
  -- Filter events by action type
  SELECT jsonb_agg(event)
  INTO filtered_events
  FROM (
    SELECT value as event
    FROM jsonb_array_elements(match_events)
    WHERE value->>'action' = action_type
    ORDER BY (value->>'timestamp')::timestamptz DESC
  ) sub;
  
  RETURN COALESCE(filtered_events, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION clear_match_events(match_uuid uuid) 
RETURNS boolean AS $$
DECLARE
  rows_affected integer;
BEGIN
  -- Validate input
  IF match_uuid IS NULL THEN
    RETURN false;
  END IF;

  UPDATE matches_live 
  SET 
    events = '[]'::jsonb,
    last_event = NULL,
    updated_at = now()
  WHERE match_id = match_uuid;
  
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION add_match_event(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION get_recent_match_events(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_match_events_by_action(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION clear_match_events(uuid) TO authenticated;

-- Add a function to check the current schema state (for debugging)
CREATE OR REPLACE FUNCTION check_matches_live_schema()
RETURNS TABLE(
  column_name text,
  data_type text,
  is_nullable text,
  column_default text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.column_name::text,
    c.data_type::text,
    c.is_nullable::text,
    c.column_default::text
  FROM information_schema.columns c
  WHERE c.table_name = 'matches_live'
  ORDER BY c.ordinal_position;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION check_matches_live_schema() TO authenticated;

-- Log the completion
DO $$
BEGIN
  RAISE NOTICE 'Migration completed: Fixed events column existence and related functions';
END $$;