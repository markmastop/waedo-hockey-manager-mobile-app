/*
  # Create matches table

  1. New Tables
    - `matches`
      - `id` (uuid, primary key)
      - `team_id` (uuid, foreign key to teams)
      - `date` (timestamp with time zone)
      - `home_team`, `away_team` (text)
      - `location`, `field` (text)
      - `lineup` (jsonb) - players currently on field
      - `reserve_players` (jsonb) - players on bench
      - `substitutions` (jsonb) - array of substitution objects
      - `match_time` (integer) - seconds since match start
      - `current_quarter` (integer) - 1-4
      - `status` (text) - upcoming, inProgress, paused, completed
      - `is_home` (boolean)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `matches` table
    - Add policies for coaches to access matches for their teams
*/

CREATE TABLE IF NOT EXISTS matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  date timestamptz NOT NULL,
  home_team text NOT NULL,
  away_team text NOT NULL,
  location text NOT NULL DEFAULT '',
  field text NOT NULL DEFAULT '',
  lineup jsonb DEFAULT '[]'::jsonb,
  reserve_players jsonb DEFAULT '[]'::jsonb,
  substitutions jsonb DEFAULT '[]'::jsonb,
  match_time integer DEFAULT 0,
  current_quarter integer DEFAULT 1,
  status text DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'inProgress', 'paused', 'completed')),
  is_home boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

-- Policy to allow coaches to read matches for their teams
CREATE POLICY "Coaches can read team matches"
  ON matches
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = matches.team_id
      AND teams.coaches @> jsonb_build_array(
        jsonb_build_object('id', auth.uid()::text)
      )
    )
  );

-- Policy to allow coaches to update matches for their teams
CREATE POLICY "Coaches can update team matches"
  ON matches
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = matches.team_id
      AND teams.coaches @> jsonb_build_array(
        jsonb_build_object('id', auth.uid()::text)
      )
    )
  );

-- Index for better performance
CREATE INDEX IF NOT EXISTS matches_team_id_idx ON matches(team_id);
CREATE INDEX IF NOT EXISTS matches_date_idx ON matches(date);
CREATE INDEX IF NOT EXISTS matches_status_idx ON matches(status);