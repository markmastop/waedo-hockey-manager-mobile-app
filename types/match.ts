import { Database, Player, Substitution } from './database';

export interface Match extends Database['public']['Tables']['matches']['Row'] {
  lineup: Player[];
  reserve_players: Player[];
  substitutions: Substitution[];
  teams: {
    name: string;
  };
}
