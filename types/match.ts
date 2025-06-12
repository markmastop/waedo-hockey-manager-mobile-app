import { Database, Player, Substitution } from './database';

export interface Match extends Database['public']['Tables']['matches']['Row'] {
  lineup: Player[];
  reserve_players: Player[];
  substitutions: Substitution[];
  teams: {
    name: string;
  };
}

export interface MatchEvent {
  id: string;
  type: 'goal' | 'card' | 'substitution' | 'quarter_start' | 'quarter_end' | 'match_start' | 'match_end';
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