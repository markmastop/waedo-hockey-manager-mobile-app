export interface Database {
  public: {
    Tables: {
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
          lineup: Player[];
          reserve_players: Player[];
          substitutions: Substitution[];
          match_time: number;
          current_quarter: number;
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
          lineup?: Player[];
          reserve_players?: Player[];
          substitutions?: Substitution[];
          match_time?: number;
          current_quarter?: number;
          status?: 'upcoming' | 'inProgress' | 'paused' | 'completed';
          is_home?: boolean;
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
          lineup?: Player[];
          reserve_players?: Player[];
          substitutions?: Substitution[];
          match_time?: number;
          current_quarter?: number;
          status?: 'upcoming' | 'inProgress' | 'paused' | 'completed';
          is_home?: boolean;
          created_at?: string;
        };
      };
    };
  };
}

export interface Player {
  id: string;
  name: string;
  number: number;
  position: string;
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