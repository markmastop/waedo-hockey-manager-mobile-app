import { supabase } from '@/lib/supabase';
import { Player } from '@/types/database';
import { MatchesLive } from '@/types/database';

export interface MatchEventLog {
  match_id: string;
  player_id?: string;
  action: 'swap' | 'goal' | 'card' | 'substitution' | 'match_start' | 'match_end' | 'quarter_start' | 'quarter_end' | 'formation_change' | 'player_selection' | 'timeout' | 'injury' | 'penalty_corner' | 'penalty_stroke' | 'green_card' | 'yellow_card' | 'red_card';
  description: string;
  match_time: number;
  quarter: number;
  metadata?: Record<string, any>;
}

class MatchEventLogger {
  private static instance: MatchEventLogger;
  private eventQueue: MatchEventLog[] = [];
  private isProcessing = false;

  static getInstance(): MatchEventLogger {
    if (!MatchEventLogger.instance) {
      MatchEventLogger.instance = new MatchEventLogger();
    }
    return MatchEventLogger.instance;
  }

  async logEvent(event: MatchEventLog): Promise<void> {
    console.log('📝 Logging match event:', event);
    
    try {
      // Ensure match_id is a valid UUID
      const matchId = typeof event.match_id === 'string' 
        ? event.match_id 
        : event.match_id.toString();

      // First try to update existing record
      const { error: updateError } = await supabase
        .from('matches_live')
        .update({
          match_id: matchId,
          current_quarter: event.quarter,
          updated_at: new Date().toISOString()
        })
        .eq('match_id', matchId);

      if (updateError) {
        console.log('🔄 No existing record found, creating new matches_live record');
        
        // Check if the match exists in matches table
        const { data: matchData, error: matchError } = await supabase
          .from('matches')
          .select('id')
          .eq('id', matchId)
          .single();

        if (matchError || !matchData) {
          console.error('❌ Match not found in matches table:', matchError || 'No match found');
          throw new Error('Match not found in matches table');
        }

        // If update fails, try to insert a new record
        const { error: insertError, data } = await supabase
          .from('matches_live')
          .insert({
            match_id: matchId,
            status: 'inProgress',
            current_quarter: event.quarter,
            home_score: 0,
            away_score: 0,
            updated_at: new Date().toISOString()
          })
          .select();

        if (insertError) {
          console.error('❌ Failed to create matches_live record:', insertError);
          console.log('Error details:', {
            match_id: matchId,
            current_quarter: event.quarter
          });
          throw insertError;
        }

        console.log('✅ Created new matches_live record:', data);
      }

      console.log('✅ Match event logged successfully');
    } catch (error) {
      console.error('💥 Exception logging match event:', error);
      throw error;
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.eventQueue.length === 0) return;
    
    this.isProcessing = true;
    console.log(`🔄 Processing ${this.eventQueue.length} queued events`);

    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift();
      if (event) {
        try {
          await this.logEvent(event);
        } catch (error) {
          console.error('❌ Failed to process queued event:', error);
          this.eventQueue.push(event);
          break;
        }
      }
    }

    this.isProcessing = false;
  }

  // Convenience methods for common events
  async logPlayerSwap(
    matchId: string,
    playerIn: Player,
    playerOut: Player,
    matchTime: number,
    quarter: number,
    fromPosition?: string,
    toPosition?: string
  ): Promise<void> {
    await this.logEvent({
      match_id: matchId,
      player_id: playerIn.id,
      action: 'swap',
      description: `${playerIn.name} (#${playerIn.number}) swapped with ${playerOut.name} (#${playerOut.number})${fromPosition && toPosition ? ` from ${fromPosition} to ${toPosition}` : ''}`,
      match_time: matchTime,
      quarter: quarter,
      metadata: {
        player_in: {
          id: playerIn.id,
          name: playerIn.name,
          number: playerIn.number,
          position: playerIn.position
        },
        player_out: {
          id: playerOut.id,
          name: playerOut.name,
          number: playerOut.number,
          position: playerOut.position
        },
        from_position: fromPosition,
        to_position: toPosition,
        swap_type: fromPosition && toPosition ? 'position_swap' : 'field_bench_swap'
      }
    });
  }

  async logGoal(
    matchId: string,
    player: Player,
    matchTime: number,
    quarter: number,
    assistedBy?: Player
  ): Promise<void> {
    await this.logEvent({
      match_id: matchId,
      player_id: player.id,
      action: 'goal',
      description: `Goal scored by ${player.name} (#${player.number})${assistedBy ? ` assisted by ${assistedBy.name} (#${assistedBy.number})` : ''}`,
      match_time: matchTime,
      quarter: quarter,
      metadata: {
        scorer: {
          id: player.id,
          name: player.name,
          number: player.number,
          position: player.position
        },
        assist: assistedBy ? {
          id: assistedBy.id,
          name: assistedBy.name,
          number: assistedBy.number,
          position: assistedBy.position
        } : null
      }
    });
  }

  async logCard(
    matchId: string,
    player: Player,
    cardType: 'yellow' | 'red' | 'green',
    matchTime: number,
    quarter: number,
    reason?: string
  ): Promise<void> {
    const actionMap = {
      'yellow': 'yellow_card' as const,
      'red': 'red_card' as const,
      'green': 'green_card' as const
    };

    await this.logEvent({
      match_id: matchId,
      player_id: player.id,
      action: actionMap[cardType],
      description: `${cardType.charAt(0).toUpperCase() + cardType.slice(1)} card given to ${player.name} (#${player.number})${reason ? ` for ${reason}` : ''}`,
      match_time: matchTime,
      quarter: quarter,
      metadata: {
        player: {
          id: player.id,
          name: player.name,
          number: player.number,
          position: player.position
        },
        card_type: cardType,
        reason: reason
      }
    });
  }

  async logSubstitution(
    matchId: string,
    playerIn: Player,
    playerOut: Player,
    position: string,
    matchTime: number,
    quarter: number
  ): Promise<void> {
    await this.logEvent({
      match_id: matchId,
      player_id: playerIn.id,
      action: 'substitution',
      description: `Substitution: ${playerIn.name} (#${playerIn.number}) in for ${playerOut.name} (#${playerOut.number}) at ${position}`,
      match_time: matchTime,
      quarter: quarter,
      metadata: {
        player_in: {
          id: playerIn.id,
          name: playerIn.name,
          number: playerIn.number,
          position: playerIn.position
        },
        player_out: {
          id: playerOut.id,
          name: playerOut.name,
          number: playerOut.number,
          position: playerOut.position
        },
        position: position
      }
    });
  }

  async logScoreChange(
    matchId: string,
    matchTime: number,
    quarter: number,
    homeScore: number,
    awayScore: number,
    previousHomeScore: number,
    previousAwayScore: number,
    teamScored?: 'home' | 'away'
  ): Promise<void> {
    const scoreDiff = {
      home: homeScore - previousHomeScore,
      away: awayScore - previousAwayScore
    };

    let description = `Score updated: ${homeScore}-${awayScore}`;
    if (teamScored) {
      const diff = teamScored === 'home' ? scoreDiff.home : scoreDiff.away;
      description = `${teamScored === 'home' ? 'Home' : 'Away'} team score ${diff > 0 ? 'increased' : 'decreased'} by ${Math.abs(diff)}. New score: ${homeScore}-${awayScore}`;
    }

    // Update the matches_live table with new scores
    try {
      const { error } = await supabase
        .from('matches_live')
        .update({
          home_score: homeScore,
          away_score: awayScore,
          updated_at: new Date().toISOString()
        })
        .eq('match_id', matchId);

      if (error) {
        console.error('❌ Failed to update scores in matches_live:', error);
      }
    } catch (error) {
      console.error('💥 Exception updating scores:', error);
    }

    await this.logEvent({
      match_id: matchId,
      action: 'score_change',
      description: description,
      match_time: matchTime,
      quarter: quarter,
      metadata: {
        new_score: {
          home: homeScore,
          away: awayScore
        },
        previous_score: {
          home: previousHomeScore,
          away: previousAwayScore
        },
        score_difference: scoreDiff,
        team_scored: teamScored,
        timestamp: new Date().toISOString()
      }
    });
  }

  async logPlayerSelection(
    matchId: string,
    player: Player,
    matchTime: number,
    quarter: number,
    selectionType: 'field' | 'bench'
  ): Promise<void> {
    await this.logEvent({
      match_id: matchId,
      player_id: player.id,
      action: 'player_selection',
      description: `Player ${player.name} (#${player.number}) selected from ${selectionType}`,
      match_time: matchTime,
      quarter: quarter,
      metadata: {
        player: {
          id: player.id,
          name: player.name,
          number: player.number,
          position: player.position
        },
        selection_type: selectionType
      }
    });
  }

  async logFormationChange(
    matchId: string,
    oldFormation: string,
    newFormation: string,
    matchTime: number,
    quarter: number
  ): Promise<void> {
    await this.logEvent({
      match_id: matchId,
      action: 'formation_change',
      description: `Formation changed from ${oldFormation} to ${newFormation}`,
      match_time: matchTime,
      quarter: quarter,
      metadata: {
        old_formation: oldFormation,
        new_formation: newFormation
      }
    });
  }

  async logTimeout(
    matchId: string,
    matchTime: number,
    quarter: number,
    teamType: 'home' | 'away'
  ): Promise<void> {
    await this.logEvent({
      match_id: matchId,
      action: 'timeout',
      description: `Timeout called by ${teamType} team`,
      match_time: matchTime,
      quarter: quarter,
      metadata: {
        team_type: teamType,
        timestamp: new Date().toISOString()
      }
    });
  }

  async logInjury(
    matchId: string,
    player: Player,
    matchTime: number,
    quarter: number,
    severity?: 'minor' | 'major'
  ): Promise<void> {
    await this.logEvent({
      match_id: matchId,
      player_id: player.id,
      action: 'injury',
      description: `Injury to ${player.name} (#${player.number})${severity ? ` (${severity})` : ''}`,
      match_time: matchTime,
      quarter: quarter,
      metadata: {
        player: {
          id: player.id,
          name: player.name,
          number: player.number,
          position: player.position
        },
        severity: severity,
        timestamp: new Date().toISOString()
      }
    });
  }

  async logPenaltyCorner(
    matchId: string,
    matchTime: number,
    quarter: number,
    teamType: 'home' | 'away'
  ): Promise<void> {
    await this.logEvent({
      match_id: matchId,
      action: 'penalty_corner',
      description: `Penalty corner awarded to ${teamType} team`,
      match_time: matchTime,
      quarter: quarter,
      metadata: {
        team_type: teamType,
        timestamp: new Date().toISOString()
      }
    });
  }

  async logPenaltyStroke(
    matchId: string,
    player: Player,
    matchTime: number,
    quarter: number,
    result: 'goal' | 'save' | 'miss'
  ): Promise<void> {
    await this.logEvent({
      match_id: matchId,
      player_id: player.id,
      action: 'penalty_stroke',
      description: `Penalty stroke by ${player.name} (#${player.number}) - ${result}`,
      match_time: matchTime,
      quarter: quarter,
      metadata: {
        player: {
          id: player.id,
          name: player.name,
          number: player.number,
          position: player.position
        },
        result: result,
        timestamp: new Date().toISOString()
      }
    });
  }

  async createMatchesLiveRecord(matchId: string, status: 'upcoming' | 'inProgress' | 'paused' | 'completed'): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('matches_live')
        .insert({
          match_id: matchId,
          status: status,
          current_time: 0,
          current_quarter: 1,
          home_score: 0,
          away_score: 0,
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('❌ Failed to create matches_live record:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('💥 Exception creating matches_live record:', error);
      return false;
    }
  }

  async logMatchStart(matchId: string): Promise<void> {
    // Create matches_live record first
    await this.createMatchesLiveRecord(matchId, 'inProgress');

    await this.logEvent({
      match_id: matchId,
      action: 'match_start',
      description: 'Match started',
      match_time: 0,
      quarter: 1,
      metadata: {
        timestamp: new Date().toISOString()
      }
    });
  }

  async logMatchEnd(matchId: string, matchTime: number, quarter: number, finalScore?: { home: number; away: number }): Promise<void> {
    // Update matches_live status to completed
    try {
      const { error } = await supabase
        .from('matches_live')
        .update({
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('match_id', matchId);

      if (error) {
        console.error('❌ Failed to update match status to completed:', error);
      }
    } catch (error) {
      console.error('💥 Exception updating match status:', error);
    }

    await this.logEvent({
      match_id: matchId,
      action: 'match_end',
      description: `Match ended${finalScore ? ` with score ${finalScore.home}-${finalScore.away}` : ''}`,
      match_time: matchTime,
      quarter: quarter,
      metadata: {
        final_score: finalScore,
        timestamp: new Date().toISOString()
      }
    });
  }

  async logQuarterStart(matchId: string, quarter: number, matchTime: number): Promise<void> {
    await this.logEvent({
      match_id: matchId,
      action: 'quarter_start',
      description: `Quarter ${quarter} started`,
      match_time: matchTime,
      quarter: quarter,
      metadata: {
        timestamp: new Date().toISOString()
      }
    });
  }

  async logQuarterEnd(matchId: string, quarter: number, matchTime: number): Promise<void> {
    await this.logEvent({
      match_id: matchId,
      action: 'quarter_end',
      description: `Quarter ${quarter} ended`,
      match_time: matchTime,
      quarter: quarter,
      metadata: {
        timestamp: new Date().toISOString()
      }
    });
  }

  // Get live match state from matches_live table
  async getLiveMatchState(matchId: string): Promise<MatchesLive | null> {
    try {
      const { data, error } = await supabase
        .from('matches_live')
        .select('*')
        .eq('match_id', matchId)
        .single();

      if (error) {
        console.error('❌ Failed to fetch live match state:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('💥 Exception fetching live match state:', error);
      return null;
    }
  }

  // Update match status
  async updateMatchStatus(matchId: string, status: 'upcoming' | 'inProgress' | 'paused' | 'completed'): Promise<void> {
    try {
      const { error } = await supabase
        .from('matches_live')
        .update({
          status: status,
          updated_at: new Date().toISOString()
        })
        .eq('match_id', matchId);

      if (error) {
        console.error('❌ Failed to update match status:', error);
        throw error;
      }

      console.log(`✅ Match status updated to: ${status}`);
    } catch (error) {
      console.error('💥 Exception updating match status:', error);
      throw error;
    }
  }

  // Update match time and quarter
  async updateMatchTime(matchId: string, currentTime: number, currentQuarter: number): Promise<void> {
    try {
      const { error } = await supabase
        .from('matches_live')
        .update({
          current_time: currentTime,
          current_quarter: currentQuarter,
          updated_at: new Date().toISOString()
        })
        .eq('match_id', matchId);

      if (error) {
        console.error('❌ Failed to update match time:', error);
        throw error;
      }
    } catch (error) {
      console.error('💥 Exception updating match time:', error);
      throw error;
    }
  }
}

export const matchEventLogger = MatchEventLogger.getInstance();