/*
  # Add player_stats column to matches table

  1. Changes
    - Add `player_stats` column to `matches` table as JSONB type
    - Set default value to empty array to maintain consistency
    - Add comment explaining the column purpose

  2. Notes
    - This column will store PlayerStats[] data as JSON
    - Default empty array prevents null handling issues
    - JSONB type allows for efficient querying and indexing
*/

-- Add player_stats column to matches table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'matches' AND column_name = 'player_stats'
  ) THEN
    ALTER TABLE matches ADD COLUMN player_stats JSONB DEFAULT '[]'::jsonb;
    
    -- Add comment to document the column
    COMMENT ON COLUMN matches.player_stats IS 'Player statistics data stored as JSONB array of PlayerStats objects';
  END IF;
END $$;