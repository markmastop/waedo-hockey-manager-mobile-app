/** Helper to convert raw player data into typed structures. */
import { Player } from '@/types/database';

/**
 * Convert flexible player data from Supabase into an array of players.
 * Handles array or object formats and filters out invalid entries.
 */
export function convertPlayersDataToArray(playersData: any): Player[] {
  if (!playersData) return [];

  if (Array.isArray(playersData)) {
    return playersData.filter(
      (player) => player && typeof player === 'object' && player.id && player.name
    );
  }

  if (typeof playersData === 'object') {
    const players: Player[] = [];
    Object.keys(playersData).forEach((position) => {
      const playerData = playersData[position];
      if (
        playerData &&
        typeof playerData === 'object' &&
        playerData.id &&
        playerData.name
      ) {
        players.push({
          id: playerData.id,
          name: playerData.name,
          number: playerData.number || 0,
          position: playerData.position || position,
        });
      }
    });
    return players;
  }

  return [];
}
