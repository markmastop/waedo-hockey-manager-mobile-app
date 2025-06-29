/*
  # Ensure add_match_event function exists with correct signature

  1. Changes
    - Drop any existing add_match_event functions to avoid conflicts
    - Create the add_match_event function with the correct parameter order
    - Grant proper permissions to authenticated users
    - Add supporting functions for match event management

  2. Security
    - Function uses SECURITY DEFINER for proper access control
    - Only authenticated users can execute the function
    - Input validation to prevent invalid data

  3. Notes
    - This migration is idempotent and safe to run multiple times
    - Matches the expected signature: add_match_event(event_data, match_uuid)
*/

-- Drop any existing versions of the function to avoid conflicts
DROP FUNCTION IF EXISTS add_match_event(uuid, jsonb);
DROP FUNCTION IF EXISTS add_match_event(jsonb, uuid);

-- Create the add_match_event function with correct parameter order
CREATE OR REPLACE FUNCTION add_match_event(
  event_data jsonb,
  match_uuid uuid
) RETURNS boolean AS $$
DECLARE
  event_with_timestamp jsonb;
  rows_affected integer;
BEGIN
  -- Validate input parameters
  IF match_uuid IS NULL THEN
    RAISE NOTICE 'Invalid input: match_uuid is NULL';
    RETURN false;
  END IF;
  
  IF event_data IS NULL THEN
    RAISE NOTICE 'Invalid input: event_data is NULL';
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
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error adding event to match %: %', match_uuid, SQLERRM;
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create supporting functions for match event management
CREATE OR REPLACE FUNCTION get_recent_match_events(
  match_uuid uuid,
  event_limit integer DEFAULT 10
) RETURNS jsonb AS $$
DECLARE
  events_result jsonb;
BEGIN
  SELECT COALESCE(
    (
      SELECT jsonb_agg(event_item ORDER BY (event_item->>'timestamp')::timestamp DESC)
      FROM (
        SELECT jsonb_array_elements(COALESCE(events, '[]'::jsonb)) as event_item
        FROM matches_live 
        WHERE match_id = match_uuid
      ) events_expanded
      LIMIT event_limit
    ),
    '[]'::jsonb
  ) INTO events_result;
  
  RETURN events_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_match_events_by_action(
  match_uuid uuid,
  action_type text
) RETURNS jsonb AS $$
DECLARE
  events_result jsonb;
BEGIN
  SELECT COALESCE(
    (
      SELECT jsonb_agg(event_item ORDER BY (event_item->>'timestamp')::timestamp DESC)
      FROM (
        SELECT jsonb_array_elements(COALESCE(events, '[]'::jsonb)) as event_item
        FROM matches_live 
        WHERE match_id = match_uuid
      ) events_expanded
      WHERE event_item->>'action' = action_type
    ),
    '[]'::jsonb
  ) INTO events_result;
  
  RETURN events_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION clear_match_events(
  match_uuid uuid
) RETURNS boolean AS $$
DECLARE
  rows_affected integer;
BEGIN
  UPDATE matches_live 
  SET 
    events = '[]'::jsonb,
    last_event = null,
    updated_at = now()
  WHERE match_id = match_uuid;
  
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  
  RETURN rows_affected > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_match_events_summary(
  match_uuid uuid
) RETURNS jsonb AS $$
DECLARE
  summary_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_events', COALESCE(jsonb_array_length(events), 0),
    'events_by_action', (
      SELECT jsonb_object_agg(action_type, action_count)
      FROM (
        SELECT 
          event_item->>'action' as action_type,
          count(*) as action_count
        FROM (
          SELECT jsonb_array_elements(COALESCE(events, '[]'::jsonb)) as event_item
          FROM matches_live 
          WHERE match_id = match_uuid
        ) events_expanded
        GROUP BY event_item->>'action'
      ) action_counts
    ),
    'last_event_time', (
      SELECT max((event_item->>'timestamp')::timestamp)
      FROM (
        SELECT jsonb_array_elements(COALESCE(events, '[]'::jsonb)) as event_item
        FROM matches_live 
        WHERE match_id = match_uuid
      ) events_expanded
    )
  ) INTO summary_result
  FROM matches_live 
  WHERE match_id = match_uuid;
  
  RETURN COALESCE(summary_result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_player_event_stats(
  match_uuid uuid,
  player_uuid uuid
) RETURNS jsonb AS $$
DECLARE
  stats_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'player_id', player_uuid,
    'total_events', count(*),
    'events_by_action', jsonb_object_agg(action_type, action_count)
  ) INTO stats_result
  FROM (
    SELECT 
      event_item->>'action' as action_type,
      count(*) as action_count
    FROM (
      SELECT jsonb_array_elements(COALESCE(events, '[]'::jsonb)) as event_item
      FROM matches_live 
      WHERE match_id = match_uuid
    ) events_expanded
    WHERE event_item->>'player_id' = player_uuid::text
    GROUP BY event_item->>'action'
  ) player_action_counts;
  
  RETURN COALESCE(stats_result, jsonb_build_object('player_id', player_uuid, 'total_events', 0, 'events_by_action', '{}'::jsonb));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION check_matches_live_schema()
RETURNS TABLE(column_name text, data_type text, is_nullable text) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.column_name::text,
    c.data_type::text,
    c.is_nullable::text
  FROM information_schema.columns c
  WHERE c.table_name = 'matches_live' 
    AND c.table_schema = 'public'
  ORDER BY c.ordinal_position;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on all functions to authenticated users
GRANT EXECUTE ON FUNCTION add_match_event(jsonb, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_recent_match_events(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_match_events_by_action(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION clear_match_events(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_match_events_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_player_event_stats(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION check_matches_live_schema() TO authenticated;

-- Log the completion
DO $$
BEGIN
  RAISE NOTICE 'Migration completed: Ensured add_match_event function and supporting functions exist with correct signatures';
END $$;