/*
  # Add scores to matches_live_events

  1. Changes
    - Add home_score and away_score columns to track the score after each event
    - Add constraint to ensure scores are non-negative
*/

ALTER TABLE matches_live_events
  ADD COLUMN IF NOT EXISTS home_score integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS away_score integer DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'matches_live_events_score_check'
  ) THEN
    ALTER TABLE matches_live_events
      ADD CONSTRAINT matches_live_events_score_check
      CHECK (home_score >= 0 AND away_score >= 0);
  END IF;
END $$;

COMMENT ON COLUMN matches_live_events.home_score IS 'Home team score after this event';
COMMENT ON COLUMN matches_live_events.away_score IS 'Away team score after this event';
