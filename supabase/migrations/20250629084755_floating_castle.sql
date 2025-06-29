/*
  # Store event description in last_event

  1. Changes
    - Update add_match_event function to ensure event description is properly stored in last_event
    - Add validation to ensure description field is present
    - Improve error handling and logging

  2. Security
    - Maintain existing RLS policies
    - Keep function security definer permissions
*/

-- Update the add_match_event function to ensure description is properly stored
CREATE OR REPLACE FUNCTION add_match_event(
  event_data jsonb,
  match_uuid uuid
) RETURNS boolean AS $$
DECLARE
  event_with_timestamp jsonb;
  rows_affected integer;
  event_description text;
BEGIN
  -- Validate input
  IF match_uuid IS NULL OR event_data IS NULL THEN
    RAISE NOTICE 'Invalid input: match_uuid or event_data is NULL';
    RETURN false;
  END IF;

  -- Extract and validate description
  event_description := event_data->>'description';
  IF event_description IS NULL OR event_description = '' THEN
    RAISE NOTICE 'Warning: Event data missing description field';
    event_description := 'No description provided';
  END IF;

  -- Add timestamp, ensure event has an ID, and ensure description is present
  event_with_timestamp := event_data || jsonb_build_object(
    'timestamp', now(),
    'id', COALESCE(event_data->>'id', gen_random_uuid()::text),
    'description', event_description
  );
  
  -- Log the event being stored
  RAISE NOTICE 'Storing event with description: %', event_description;
  
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
  
  RAISE NOTICE 'Successfully added event to match % with description: %', match_uuid, event_description;
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on the function
GRANT EXECUTE ON FUNCTION add_match_event(jsonb, uuid) TO authenticated;

-- Add a helper function to get just the last event description for quick access
CREATE OR REPLACE FUNCTION get_last_event_description(match_uuid uuid)
RETURNS text AS $$
DECLARE
  last_description text;
BEGIN
  -- Validate input
  IF match_uuid IS NULL THEN
    RETURN NULL;
  END IF;

  -- Get the description from the last event
  SELECT last_event->>'description' INTO last_description
  FROM matches_live
  WHERE match_id = match_uuid;
  
  RETURN last_description;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on the helper function
GRANT EXECUTE ON FUNCTION get_last_event_description(uuid) TO authenticated;

-- Add comment to document the enhancement
COMMENT ON FUNCTION add_match_event(jsonb, uuid) IS 'Adds an event to matches_live with proper description storage in both events array and last_event field';
COMMENT ON FUNCTION get_last_event_description(uuid) IS 'Helper function to quickly retrieve the description of the most recent event for a match';

-- Log the completion
DO $$
BEGIN
  RAISE NOTICE 'Migration completed: Enhanced event description storage in last_event';
END $$;