/*
  # Fix match_key column constraint in matches_live table

  1. Changes
    - Make the 'match_key' column in 'matches_live' table nullable
    - This resolves the NOT NULL constraint violation error when inserting/updating records

  2. Reasoning
    - The application code doesn't provide values for the 'match_key' column
    - The TypeScript interface doesn't include this column
    - Making it nullable allows the application to function without breaking changes
*/

-- Make match_key column nullable in matches_live table
ALTER TABLE matches_live ALTER COLUMN match_key DROP NOT NULL;