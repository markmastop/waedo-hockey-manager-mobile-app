/*
  # Fix add_match_event function parameter order

  1. Changes
    - Drop existing add_match_event function
    - Recreate with correct parameter order: (event_data, match_uuid)
    - This matches what the Supabase client is calling

  2. Notes
    - The client is calling add_match_event(event_data, match_uuid)
    - But the function was defined as add_match_event(match_uuid, event_data)
    - This causes a "function not found in schema cache" error
*/

-- Drop the existing function with the wrong parameter order
DROP FUNCTION IF EXISTS add_match_event(uuid, jsonb);

-- Recreate the function with the correct parameter order that matches client calls
CREATE OR REPLACE FUNCTION add_match_event(
  event_data jsonb,
  match_uuid uuid
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

-- Grant execute permissions on the function
GRANT EXECUTE ON FUNCTION add_match_event(jsonb, uuid) TO authenticated;

-- Log the completion
DO $$
BEGIN
  RAISE NOTICE 'Migration completed: Fixed add_match_event function parameter order';
END $$;