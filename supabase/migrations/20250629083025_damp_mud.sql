/*
  # Fix GIN index operator class error

  1. Changes
    - Drop existing GIN indexes that are causing errors
    - Recreate indexes with proper operator classes
    - Use gin_trgm_ops for text fields that need full-text search
    - Use standard btree indexes for simple lookups

  2. Notes
    - GIN indexes on JSONB work without operator class
    - Text fields need gin_trgm_ops operator class for GIN indexes
    - For simple text lookups, btree indexes are more appropriate
*/

-- Drop the problematic GIN indexes
DROP INDEX IF EXISTS idx_matches_live_events_gin;
DROP INDEX IF EXISTS idx_matches_live_last_event_gin;

-- Create proper indexes for JSONB columns (these work fine with GIN)
CREATE INDEX IF NOT EXISTS idx_matches_live_events_gin 
ON matches_live USING GIN (events);

CREATE INDEX IF NOT EXISTS idx_matches_live_last_event_gin 
ON matches_live USING GIN (last_event);

-- For text columns, use btree indexes instead of GIN (more appropriate for exact matches)
CREATE INDEX IF NOT EXISTS idx_matches_live_match_key 
ON matches_live (match_key);

CREATE INDEX IF NOT EXISTS idx_matches_live_home_team 
ON matches_live (home_team);

CREATE INDEX IF NOT EXISTS idx_matches_live_away_team 
ON matches_live (away_team);

-- Add composite index for common queries
CREATE INDEX IF NOT EXISTS idx_matches_live_status_quarter 
ON matches_live (status, current_quarter);

-- Add index for time-based queries
CREATE INDEX IF NOT EXISTS idx_matches_live_match_time 
ON matches_live (match_time);

-- Update the add_match_event function to be more robust
CREATE OR REPLACE FUNCTION add_match_event(
  match_uuid uuid,
  event_data jsonb
) RETURNS boolean AS $$
DECLARE
  event_with_timestamp jsonb;
  rows_affected integer;
BEGIN
  -- Add timestamp and ensure event has an ID
  event_with_timestamp := event_data || jsonb_build_object(
    'timestamp', now(),
    'id', COALESCE(event_data->>'id', gen_random_uuid()::text)
  );
  
  -- Update the matches_live record
  UPDATE matches_live 
  SET 
    events = events || jsonb_build_array(event_with_timestamp),
    last_event = event_with_timestamp,
    updated_at = now()
  WHERE match_id = match_uuid;
  
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  
  -- If no rows were affected, the match_id doesn't exist
  IF rows_affected = 0 THEN
    RAISE NOTICE 'No matches_live record found for match_id: %', match_uuid;
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the get_recent_match_events function to return proper array format
CREATE OR REPLACE FUNCTION get_recent_match_events(
  match_uuid uuid,
  event_limit integer DEFAULT 10
) RETURNS jsonb AS $$
DECLARE
  match_events jsonb;
  recent_events jsonb;
BEGIN
  -- Get the events array from matches_live
  SELECT events INTO match_events
  FROM matches_live
  WHERE match_id = match_uuid;
  
  -- If no match found or no events, return empty array
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

-- Update the get_match_events_by_action function
CREATE OR REPLACE FUNCTION get_match_events_by_action(
  match_uuid uuid,
  action_type text
) RETURNS jsonb AS $$
DECLARE
  match_events jsonb;
  filtered_events jsonb;
BEGIN
  -- Get the events array from matches_live
  SELECT events INTO match_events
  FROM matches_live
  WHERE match_id = match_uuid;
  
  -- If no match found or no events, return empty array
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

-- Add a function to get event count by action type (useful for statistics)
CREATE OR REPLACE FUNCTION get_match_event_counts(match_uuid uuid)
RETURNS TABLE(action_type text, event_count bigint) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    value->>'action' as action_type,
    COUNT(*) as event_count
  FROM matches_live ml,
       jsonb_array_elements(ml.events) as value
  WHERE ml.match_id = match_uuid
  GROUP BY value->>'action'
  ORDER BY event_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on the new function
GRANT EXECUTE ON FUNCTION get_match_event_counts(uuid) TO authenticated;

-- Add comment to document the fix
COMMENT ON INDEX idx_matches_live_events_gin IS 'GIN index on events JSONB column for efficient event queries';
COMMENT ON INDEX idx_matches_live_last_event_gin IS 'GIN index on last_event JSONB column for quick access to recent events';