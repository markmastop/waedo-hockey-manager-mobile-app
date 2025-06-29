/*
  # Add events JSON column to matches_live table

  1. Changes
    - Add `events` column as JSONB array to store all match events
    - Add `last_event` column as JSONB to store the most recent event for quick access
    - Add indexes for better query performance on events
    - Add helper functions for event management

  2. Security
    - Maintain existing RLS policies
    - Add functions for event manipulation
*/

-- Add events columns to matches_live table
DO $$
BEGIN
  -- Add events array column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'matches_live' AND column_name = 'events'
  ) THEN
    ALTER TABLE matches_live ADD COLUMN events JSONB DEFAULT '[]'::jsonb;
    COMMENT ON COLUMN matches_live.events IS 'Array of all match events stored as JSONB';
  END IF;

  -- Add last_event column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'matches_live' AND column_name = 'last_event'
  ) THEN
    ALTER TABLE matches_live ADD COLUMN last_event JSONB;
    COMMENT ON COLUMN matches_live.last_event IS 'Most recent match event for quick access in live environment';
  END IF;
END $$;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_matches_live_events_gin ON matches_live USING GIN (events);
CREATE INDEX IF NOT EXISTS idx_matches_live_last_event_gin ON matches_live USING GIN (last_event);

-- Function to add event to matches_live
CREATE OR REPLACE FUNCTION add_match_event(
  match_uuid uuid,
  event_data jsonb
) RETURNS boolean AS $$
DECLARE
  event_with_timestamp jsonb;
BEGIN
  -- Add timestamp to event if not present
  event_with_timestamp := event_data || jsonb_build_object('timestamp', now());
  
  -- Update the matches_live record
  UPDATE matches_live 
  SET 
    events = events || jsonb_build_array(event_with_timestamp),
    last_event = event_with_timestamp,
    updated_at = now()
  WHERE match_id = match_uuid;
  
  -- Return true if a row was updated
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get recent events
CREATE OR REPLACE FUNCTION get_recent_match_events(
  match_uuid uuid,
  event_limit integer DEFAULT 10
) RETURNS jsonb AS $$
DECLARE
  recent_events jsonb;
BEGIN
  SELECT jsonb_agg(event ORDER BY (event->>'timestamp')::timestamptz DESC)
  INTO recent_events
  FROM (
    SELECT jsonb_array_elements(events) as event
    FROM matches_live
    WHERE match_id = match_uuid
    ORDER BY (jsonb_array_elements(events)->>'timestamp')::timestamptz DESC
    LIMIT event_limit
  ) sub;
  
  RETURN COALESCE(recent_events, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get events by action type
CREATE OR REPLACE FUNCTION get_match_events_by_action(
  match_uuid uuid,
  action_type text
) RETURNS jsonb AS $$
DECLARE
  filtered_events jsonb;
BEGIN
  SELECT jsonb_agg(event ORDER BY (event->>'timestamp')::timestamptz DESC)
  INTO filtered_events
  FROM (
    SELECT jsonb_array_elements(events) as event
    FROM matches_live
    WHERE match_id = match_uuid
  ) sub
  WHERE event->>'action' = action_type;
  
  RETURN COALESCE(filtered_events, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clear all events (useful for testing)
CREATE OR REPLACE FUNCTION clear_match_events(match_uuid uuid) 
RETURNS boolean AS $$
BEGIN
  UPDATE matches_live 
  SET 
    events = '[]'::jsonb,
    last_event = NULL,
    updated_at = now()
  WHERE match_id = match_uuid;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION add_match_event(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION get_recent_match_events(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_match_events_by_action(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION clear_match_events(uuid) TO authenticated;

-- Update existing records to have empty events array
UPDATE matches_live 
SET events = '[]'::jsonb 
WHERE events IS NULL;