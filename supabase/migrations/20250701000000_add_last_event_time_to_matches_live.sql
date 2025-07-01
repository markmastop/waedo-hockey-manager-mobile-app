/*
  # Add last_event_time to matches_live

  1. Changes
    - Add last_event_time column to store when the most recent event occurred
*/

ALTER TABLE matches_live
  ADD COLUMN IF NOT EXISTS last_event_time timestamptz;

COMMENT ON COLUMN matches_live.last_event_time IS 'Timestamp when the most recent event occurred';
