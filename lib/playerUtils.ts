import { Player } from '@/types/database';

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
