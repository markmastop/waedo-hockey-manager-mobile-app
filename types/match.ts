/** Shared domain interfaces for matches and player stats. */
import { Database, Player, Substitution, Coach } from './database';

export interface Team {
  id: string;
  name: string;
  players: Player[];
  coach: Coach[];
}

export interface Match {
  id: string;
  team_id: string;
  date: string;
  home_team: string;
  away_team: string;
  location: string;
  field: string;
  formation: string;
  formation_key?: string;
  match_key?: string;
  lineup: Player[];
  reserve_players: Player[];
  substitutions: Substitution[];
  substitution_schedule: any;
  match_events: MatchEvent[];
  player_stats: PlayerStats[];
  match_time: number;
  current_quarter: number;
  quarter_times: number[];
  status: 'upcoming' | 'inProgress' | 'paused' | 'completed';
  is_home: boolean;
  home_score: number;
  away_score: number;
  created_at: string;
}

export interface MatchEvent {
  id: string;
  type: 'goal' | 'card' | 'substitution' | 'quarter_start' | 'quarter_end' | 'match_start' | 'match_end' | 'match_pause';
  time: number;
  quarter: number;
  player?: Player;
  details?: string;
  timestamp: string;
}

export interface PlayerStats {
  playerId: string;
  timeOnField: number;
  quartersPlayed: number[];
  substitutions: number;
  goals?: number;
  assists?: number;
  cards?: number;
}