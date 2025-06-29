/*
  # Add club_logo_url column to matches table

  1. Changes
    - Add `club_logo_url` column to `matches` table as TEXT type
    - Column is nullable to allow existing records without logos
    - Add comment explaining the column purpose

  2. Notes
    - This column will store URLs to team/club logos
    - Nullable to maintain compatibility with existing data
    - Can be updated later with actual logo URLs
*/

-- Add club_logo_url column to matches table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'matches' AND column_name = 'club_logo_url'
  ) THEN
    ALTER TABLE matches ADD COLUMN club_logo_url TEXT;
    
    -- Add comment to document the column
    COMMENT ON COLUMN matches.club_logo_url IS 'URL to the club/team logo image';
  END IF;
END $$;