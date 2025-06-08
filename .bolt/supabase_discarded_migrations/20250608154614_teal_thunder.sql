/*
  # Create teams table

  1. New Tables
    - `teams`
      - `id` (uuid, primary key)
      - `name` (text)
      - `players` (jsonb) - array of player objects with id, name, number, position
      - `coaches` (jsonb) - array of coach objects with id, name
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `teams` table
    - Add policy for authenticated users to read teams where they are coaches
*/

CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  players jsonb DEFAULT '[]'::jsonb,
  coaches jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

-- Policy to allow coaches to read their teams
CREATE POLICY "Coaches can read their teams"
  ON teams
  FOR SELECT
  TO authenticated
  USING (
    coaches @> jsonb_build_array(
      jsonb_build_object('id', auth.uid()::text)
    )
  );

-- Policy to allow coaches to update their teams
CREATE POLICY "Coaches can update their teams"
  ON teams
  FOR UPDATE
  TO authenticated
  USING (
    coaches @> jsonb_build_array(
      jsonb_build_object('id', auth.uid()::text)
    )
  );