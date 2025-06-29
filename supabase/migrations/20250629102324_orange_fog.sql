/*
  # Create add_match_event database function

  1. New Functions
    - `add_match_event` - Adds an event to the matches_live events array
    - `get_recent_match_events` - Gets recent events for a match
    - `get_match_events_by_action` - Gets events filtered by action type
    - `clear_match_events` - Clears all events for a match
    - `get_match_events_summary` - Gets event summary statistics
    - `get_player_event_stats` - Gets player-specific event statistics
    - `check_matches_live_schema` - Checks if matches_live table has correct schema

  2. Security
    - All functions use security definer to ensure proper access
    - Functions validate input parameters

  3. Functionality
    - Handles JSON event data storage and retrieval
    - Provides efficient querying of match events
    - Supports event filtering and statistics
*/

-- Function to check matches_live schema
CREATE OR REPLACE FUNCTION check_matches_live_schema()
RETURNS TABLE(column_name text, data_type text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.column_name::text,
    c.data_type::text
  FROM information_schema.columns c
  WHERE c.table_name = 'matches_live'
    AND c.table_schema = 'public';
END;
$$;

-- Function to add an event to matches_live
CREATE OR REPLACE FUNCTION add_match_event(
  event_data jsonb,
  match_uuid uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update the matches_live record by appending the event and updating last_event
  UPDATE matches_live 
  SET 
    events = COALESCE(events, '[]'::jsonb) || jsonb_build_array(event_data),
    last_event = event_data,
    updated_at = now()
  WHERE match_id = match_uuid;
  
  -- If no rows were updated, the match doesn't exist
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match with ID % not found', match_uuid;
  END IF;
END;
$$;

-- Function to get recent match events
CREATE OR REPLACE FUNCTION get_recent_match_events(
  match_uuid uuid,
  event_limit integer DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  events_result jsonb;
BEGIN
  SELECT 
    COALESCE(
      (
        SELECT jsonb_agg(event_item ORDER BY (event_item->>'timestamp')::timestamp DESC)
        FROM jsonb_array_elements(COALESCE(events, '[]'::jsonb)) AS event_item
        LIMIT event_limit
      ),
      '[]'::jsonb
    )
  INTO events_result
  FROM matches_live
  WHERE match_id = match_uuid;
  
  RETURN COALESCE(events_result, '[]'::jsonb);
END;
$$;

-- Function to get events by action type
CREATE OR REPLACE FUNCTION get_match_events_by_action(
  match_uuid uuid,
  action_type text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  events_result jsonb;
BEGIN
  SELECT 
    COALESCE(
      (
        SELECT jsonb_agg(event_item ORDER BY (event_item->>'timestamp')::timestamp DESC)
        FROM jsonb_array_elements(COALESCE(events, '[]'::jsonb)) AS event_item
        WHERE event_item->>'action' = action_type
      ),
      '[]'::jsonb
    )
  INTO events_result
  FROM matches_live
  WHERE match_id = match_uuid;
  
  RETURN COALESCE(events_result, '[]'::jsonb);
END;
$$;

-- Function to clear match events
CREATE OR REPLACE FUNCTION clear_match_events(match_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE matches_live 
  SET 
    events = '[]'::jsonb,
    last_event = null,
    updated_at = now()
  WHERE match_id = match_uuid;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match with ID % not found', match_uuid;
  END IF;
END;
$$;

-- Function to get match events summary
CREATE OR REPLACE FUNCTION get_match_events_summary(match_uuid uuid)
RETURNS TABLE(
  action_type text,
  event_count bigint,
  latest_event_time timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    event_item->>'action' as action_type,
    COUNT(*) as event_count,
    MAX((event_item->>'timestamp')::timestamp with time zone) as latest_event_time
  FROM matches_live m,
       jsonb_array_elements(COALESCE(m.events, '[]'::jsonb)) AS event_item
  WHERE m.match_id = match_uuid
  GROUP BY event_item->>'action'
  ORDER BY event_count DESC;
END;
$$;

-- Function to get player event statistics
CREATE OR REPLACE FUNCTION get_player_event_stats(
  match_uuid uuid,
  player_uuid uuid
)
RETURNS TABLE(
  action_type text,
  event_count bigint,
  latest_event_time timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    event_item->>'action' as action_type,
    COUNT(*) as event_count,
    MAX((event_item->>'timestamp')::timestamp with time zone) as latest_event_time
  FROM matches_live m,
       jsonb_array_elements(COALESCE(m.events, '[]'::jsonb)) AS event_item
  WHERE m.match_id = match_uuid
    AND (event_item->>'player_id')::uuid = player_uuid
  GROUP BY event_item->>'action'
  ORDER BY event_count DESC;
END;
$$;