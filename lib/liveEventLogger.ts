import { supabase } from '@/lib/supabase';
import { isValidUUID } from '@/lib/validation';
import { Player } from '@/types/database';

export type MatchEventAction =
  | 'swap'
  | 'goal'
  | 'card'
  | 'substitution'
  | 'match_start'
  | 'match_end'
  | 'quarter_start'
  | 'quarter_end'
  | 'formation_change'
  | 'player_selection'
  | 'timeout'
  | 'injury'
  | 'penalty_corner'
  | 'penalty_stroke'
  | 'green_card'
  | 'yellow_card'
  | 'red_card'
  | 'score_change';

interface LogEventParams {
  matchId: string;
  action: MatchEventAction;
  description: string;
  matchTime?: number;
  quarter?: number;
  playerId?: string;
  teamId?: string;
  homeScore?: number;
  awayScore?: number;
  metadata?: Record<string, any>;
}

export async function logEvent(params: LogEventParams): Promise<void> {
  const { matchId, action, description, matchTime, quarter, playerId, teamId, homeScore, awayScore, metadata } = params;
  if (!isValidUUID(matchId)) {
    console.error('Invalid match ID for event log:', matchId);
    return;
  }

  const { error } = await supabase.from('matches_live_events').insert({
    match_id: matchId,
    player_id: playerId,
    team_id: teamId,
    home_score: homeScore,
    away_score: awayScore,
    action,
    description,
    match_time: matchTime,
    quarter,
    metadata,
  });

  if (error) {
    console.error('Failed to log match event:', error);
    return;
  }

  await supabase
    .from('matches_live')
    .update({ last_event: { description }, updated_at: new Date().toISOString() })
    .eq('match_id', matchId);
}

export async function logSubstitution(
  matchId: string,
  playerIn: Player,
  playerOut: Player,
  matchTime: number,
  quarter: number,
): Promise<void> {
  await logEvent({
    matchId,
    playerId: playerIn.id,
    action: 'substitution',
    description: `Substitution: ${playerIn.name} in for ${playerOut.name}`,
    matchTime,
    quarter,
    metadata: {
      player_in: { id: playerIn.id, name: playerIn.name, number: playerIn.number },
      player_out: { id: playerOut.id, name: playerOut.name, number: playerOut.number },
    },
  });
}

export async function logPlayerSwap(
  matchId: string,
  player1: Player,
  player2: Player,
  matchTime: number,
  quarter: number,
  fromPosition?: string,
  toPosition?: string,
): Promise<void> {
  await logEvent({
    matchId,
    playerId: player1.id,
    action: 'swap',
    description: `${player1.name} swapped with ${player2.name}`,
    matchTime,
    quarter,
    metadata: {
      player_in: { id: player1.id, name: player1.name, number: player1.number },
      player_out: { id: player2.id, name: player2.name, number: player2.number },
      from_position: fromPosition,
      to_position: toPosition,
    },
  });
}

export async function logScoreChange(
  matchId: string,
  matchTime: number,
  quarter: number,
  newHome: number,
  newAway: number,
  prevHome: number,
  prevAway: number,
  team?: 'home' | 'away',
): Promise<void> {
  await logEvent({
    matchId,
    action: 'score_change',
    description: `Score updated to ${newHome}-${newAway}`,
    matchTime,
    quarter,
    homeScore: newHome,
    awayScore: newAway,
    metadata: {
      new_score: { home: newHome, away: newAway },
      previous_score: { home: prevHome, away: prevAway },
      team_scored: team,
    },
  });
}

export async function logMatchStart(matchId: string): Promise<void> {
  await logEvent({
    matchId,
    action: 'match_start',
    description: 'Match started',
    matchTime: 0,
    quarter: 1,
    homeScore: 0,
    awayScore: 0,
  });
}

export async function logMatchEnd(
  matchId: string,
  matchTime: number,
  quarter: number,
  finalHome: number,
  finalAway: number,
): Promise<void> {
  await logEvent({
    matchId,
    action: 'match_end',
    description: `Match ended with score ${finalHome}-${finalAway}`,
    matchTime,
    quarter,
    homeScore: finalHome,
    awayScore: finalAway,
    metadata: {
      final_score: { home: finalHome, away: finalAway },
    },
  });
}
