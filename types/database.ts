export interface MatchesLive {
  id: string;
  match_id: string;
  status: 'upcoming' | 'inProgress' | 'paused' | 'completed';
  current_quarter: number;
  home_score: number;
  away_score: number;
  match_key: string | null;
  home_team: string;
  away_team: string;
  club_logo_url: string | null;
  updated_at: string;
}

export interface Database {
  public: {
    Tables: {
      matches_live: {
        Row: MatchesLive;
        Insert: Omit<MatchesLive, 'id'>;
        Update: Partial<MatchesLive>;
      };
      teams: {
        Row: {
          id: string;
          name: string;
          players: Player[];
          coach: Coach[];
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          players: Player[];
          coach: Coach[];
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          players?: Player[];
          coach?: Coach[];
          created_at?: string;
        };
      };
      matches: {
        Row: {
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
          club_logo_url?: string;
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
          created_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          date: string;
          home_team: string;
          away_team: string;
          location: string;
          field: string;
          formation?: string;
          formation_key?: string;
          match_key?: string;
          club_logo_url?: string;
          lineup?: Player[];
          reserve_players?: Player[];
          substitutions?: Substitution[];
          substitution_schedule?: any;
          match_events?: MatchEvent[];
          player_stats?: PlayerStats[];
          match_time?: number;
          current_quarter?: number;
          quarter_times?: number[];
          status?: 'upcoming' | 'inProgress' | 'paused' | 'completed';
          is_home?: boolean;
          home_score?: number;
          away_score?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          team_id?: string;
          date?: string;
          home_team?: string;
          away_team?: string;
          location?: string;
          field?: string;
          formation?: string;
          formation_key?: string;
          match_key?: string;
          club_logo_url?: string;
          lineup?: Player[];
          reserve_players?: Player[];
          substitutions?: Substitution[];
          substitution_schedule?: any;
          match_events?: MatchEvent[];
          player_stats?: PlayerStats[];
          match_time?: number;
          current_quarter?: number;
          quarter_times?: number[];
          status?: 'upcoming' | 'inProgress' | 'paused' | 'completed';
          is_home?: boolean;
          home_score?: number;
          away_score?: number;
          created_at?: string;
        };
      };
      formations: {
        Row: {
          id: string;
          name: string;
          positions: FormationPosition[];
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          positions: FormationPosition[];
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          positions?: FormationPosition[];
          created_at?: string;
        };
      };
      matches_live_events: {
        Row: {
          id: string;
          match_id: string;
          player_id?: string;
          action: 'swap' | 'goal' | 'card' | 'substitution' | 'match_start' | 'match_end' | 'quarter_start' | 'quarter_end' | 'formation_change' | 'player_selection' | 'timeout' | 'injury' | 'penalty_corner' | 'penalty_stroke' | 'green_card' | 'yellow_card' | 'red_card' | 'score_change';
          description: string;
          match_time: number;
          quarter: number;
          metadata: Record<string, any>;
          created_at: string;
        };
        Insert: {
          id?: string;
          match_id: string;
          player_id?: string;
          action: 'swap' | 'goal' | 'card' | 'substitution' | 'match_start' | 'match_end' | 'quarter_start' | 'quarter_end' | 'formation_change' | 'player_selection' | 'timeout' | 'injury' | 'penalty_corner' | 'penalty_stroke' | 'green_card' | 'yellow_card' | 'red_card' | 'score_change';
          description: string;
          match_time?: number;
          quarter?: number;
          metadata?: Record<string, any>;
          created_at?: string;
        };
        Update: {
          id?: string;
          match_id?: string;
          player_id?: string;
          action?: 'swap' | 'goal' | 'card' | 'substitution' | 'match_start' | 'match_end' | 'quarter_start' | 'quarter_end' | 'formation_change' | 'player_selection' | 'timeout' | 'injury' | 'penalty_corner' | 'penalty_stroke' | 'green_card' | 'yellow_card' | 'red_card' | 'score_change';
          description?: string;
          match_time?: number;
          quarter?: number;
          metadata?: Record<string, any>;
          created_at?: string;
        };
      };
    };
    Functions: {
      get_match_events_summary: {
        Args: {
          match_uuid: string;
        };
        Returns: {
          action_type: string;
          event_count: number;
          first_occurrence: string;
          last_occurrence: string;
        }[];
      };
      get_player_event_stats: {
        Args: {
          match_uuid: string;
          player_uuid: string;
        };
        Returns: {
          action_type: string;
          event_count: number;
          avg_match_time: number;
          quarters_active: number[];
        }[];
      };
    };
  };
}

export interface Player {
  id: string;
  name: string;
  number: number;
  position: string;
  condition?: number;
  isGoalkeeper?: boolean;
}

export interface Coach {
  id: string;
  name: string;
}

export interface Substitution {
  time: number;
  quarter: number;
  playerIn: Player;
  playerOut: Player;
  timestamp: string;
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

export interface FormationPosition {
  id: string;
  name: string;
  dutch_name?: string;
  label_translations?: {
    nl?: string;
    en?: string;
    [key: string]: string | undefined;
  };
  order: number;
  x: number;
  y: number;
}