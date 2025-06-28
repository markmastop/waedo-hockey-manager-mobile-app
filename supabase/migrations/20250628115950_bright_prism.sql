/*
  # Enhance matches_live_events table for comprehensive logging

  1. Changes
    - Add additional indexes for better query performance
    - Add constraints for data integrity
    - Add additional action types for comprehensive event tracking
    - Optimize existing structure for better performance

  2. New Features
    - Enhanced indexing strategy
    - Better data validation
    - Support for more event types
    - Improved query performance

  3. Security
    - Maintain existing RLS policies
    - Add additional security constraints
*/

-- Add check constraint for valid action types
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'matches_live_events_action_check'
  ) THEN
    ALTER TABLE matches_live_events 
    ADD CONSTRAINT matches_live_events_action_check 
    CHECK (action IN (
      'swap', 'goal', 'card', 'substitution', 
      'match_start', 'match_end', 'quarter_start', 'quarter_end', 
      'formation_change', 'player_selection', 'timeout', 'injury',
      'penalty_corner', 'penalty_stroke', 'green_card', 'yellow_card', 'red_card'
    ));
  END IF;
END $$;

-- Add check constraint for valid quarter values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'matches_live_events_quarter_check'
  ) THEN
    ALTER TABLE matches_live_events 
    ADD CONSTRAINT matches_live_events_quarter_check 
    CHECK (quarter >= 1 AND quarter <= 4);
  END IF;
END $$;

-- Add check constraint for non-negative match_time
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'matches_live_events_match_time_check'
  ) THEN
    ALTER TABLE matches_live_events 
    ADD CONSTRAINT matches_live_events_match_time_check 
    CHECK (match_time >= 0);
  END IF;
END $$;

-- Create composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_matches_live_events_match_action_time 
ON matches_live_events(match_id, action, match_time);

CREATE INDEX IF NOT EXISTS idx_matches_live_events_match_quarter_time 
ON matches_live_events(match_id, quarter, match_time);

CREATE INDEX IF NOT EXISTS idx_matches_live_events_player_action 
ON matches_live_events(player_id, action) 
WHERE player_id IS NOT NULL;

-- Create partial index for recent events (last 24 hours)
CREATE INDEX IF NOT EXISTS idx_matches_live_events_recent 
ON matches_live_events(match_id, created_at) 
WHERE created_at > (NOW() - INTERVAL '24 hours');

-- Add function to get match events summary
CREATE OR REPLACE FUNCTION get_match_events_summary(match_uuid uuid)
RETURNS TABLE(
  action_type text,
  event_count bigint,
  first_occurrence timestamptz,
  last_occurrence timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mle.action as action_type,
    COUNT(*) as event_count,
    MIN(mle.created_at) as first_occurrence,
    MAX(mle.created_at) as last_occurrence
  FROM matches_live_events mle
  WHERE mle.match_id = match_uuid
  GROUP BY mle.action
  ORDER BY event_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add function to get player event statistics
CREATE OR REPLACE FUNCTION get_player_event_stats(match_uuid uuid, player_uuid text)
RETURNS TABLE(
  action_type text,
  event_count bigint,
  avg_match_time numeric,
  quarters_active integer[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mle.action as action_type,
    COUNT(*) as event_count,
    AVG(mle.match_time) as avg_match_time,
    ARRAY_AGG(DISTINCT mle.quarter ORDER BY mle.quarter) as quarters_active
  FROM matches_live_events mle
  WHERE mle.match_id = match_uuid 
    AND mle.player_id = player_uuid
  GROUP BY mle.action
  ORDER BY event_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on functions to authenticated users
GRANT EXECUTE ON FUNCTION get_match_events_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_player_event_stats(uuid, text) TO authenticated;

-- Add comment to document the enhanced table
COMMENT ON TABLE matches_live_events IS 'Enhanced comprehensive logging of all match events including swaps, goals, cards, and other actions with optimized indexing and validation';