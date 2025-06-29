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

  async getMatchKey(matchId: string): Promise<string | null> {
    try {
      const { data: matchData, error } = await supabase
        .from('matches')
        .select('match_key')
        .eq('id', matchId)
        .single();

      if (error) {
        console.error('❌ Error fetching match_key:', error);
        return null;
      }

      return matchData?.match_key || null;
    } catch (error) {
      console.error('💥 Exception fetching match_key:', error);
      return null;
    }
  }

  async ensureMatchesLiveRecord(matchId: string, quarter: number = 1): Promise<void> {
    console.log('🔍 Ensuring matches_live record exists for match:', matchId);
    
    try {
      // First, check if record already exists
      const { data: existingRecord, error: selectError } = await supabase
        .from('matches_live')
        .select('id, match_id')
        .eq('match_id', matchId)
        .maybeSingle();

      if (selectError) {
        console.error('❌ Error checking for existing matches_live record:', selectError);
        throw selectError;
      }

      if (existingRecord) {
        console.log('✅ matches_live record already exists:', existingRecord.id);
        return;
      }

      console.log('📝 Creating new matches_live record...');

      // Verify the match exists in the matches table and get match_key
      const { data: matchData, error: matchError } = await supabase
        .from('matches')
        .select('id, home_team, away_team, match_key')
        .eq('id', matchId)
        .single();

      if (matchError || !matchData) {
        console.error('❌ Match not found in matches table:', matchError || 'No match found');
        throw new Error(`Match ${matchId} not found in matches table`);
      }

      console.log('✅ Match found in matches table:', matchData);

      // Create new matches_live record with match_key
      const { error: insertError, data: insertedData } = await supabase
        .from('matches_live')
        .insert({
          match_id: matchId,
          match_key: matchData.match_key,
          status: 'upcoming',
          match_time: 0,
          current_quarter: quarter,
          home_score: 0,
          away_score: 0,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) {
        console.error('❌ Failed to create matches_live record:', insertError);
        console.log('Insert attempt details:', {
          match_id: matchId,
          match_key: matchData.match_key,
          current_quarter: quarter,
          timestamp: new Date().toISOString()
        });
        throw insertError;
      }

      console.log('✅ Successfully created matches_live record:', insertedData);
    } catch (error) {
      console.error('💥 Exception in ensureMatchesLiveRecord:', error);
      throw error;
    }
  }

  async updateMatchesLiveRecord(
    matchId: string, 
    updates: Partial<{
      status: 'upcoming' | 'inProgress' | 'paused' | 'completed';
      match_time: number;
      current_quarter: number;
      home_score: number;
      away_score: number;
    }>
  ): Promise<void> {
    console.log('🔄 Updating matches_live record:', matchId, updates);
    
    try {
      // Ensure record exists first
      await this.ensureMatchesLiveRecord(matchId, updates.current_quarter || 1);

      // Now update the record
      const { error: updateError, data: updatedData } = await supabase
        .from('matches_live')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('match_id', matchId)
        .select()
        .single();

      if (updateError) {
        console.error('❌ Failed to update matches_live record:', updateError);
        throw updateError;
      }

      console.log('✅ Successfully updated matches_live record:', updatedData);
    } catch (error) {
      console.error('💥 Exception updating matches_live record:', error);
      throw error;
    }
  }

  async logEvent(event: MatchEventLog): Promise<void> {
    console.log('📝 Logging match event:', event);
    
    try {
      // Ensure match_id is a valid UUID
      const matchId = typeof event.match_id === 'string' 
        ? event.match_id 
        : event.match_id.toString();

      // Ensure matches_live record exists and update it
      await this.updateMatchesLiveRecord(matchId, {
        current_quarter: event.quarter,
        match_time: event.match_time
      });

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
    await this.updateMatchesLiveRecord(matchId, {
      home_score: homeScore,
      away_score: awayScore,
      match_time: matchTime,
      current_quarter: quarter
    });

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
      await this.ensureMatchesLiveRecord(matchId, 1);
      
      // Update the status if different from default
      if (status !== 'upcoming') {
        await this.updateMatchesLiveRecord(matchId, { status });
      }
      
      return true;
    } catch (error) {
      console.error('💥 Exception creating matches_live record:', error);
      return false;
    }
  }

  async logMatchStart(matchId: string): Promise<void> {
    // Ensure matches_live record exists and set status to inProgress
    await this.updateMatchesLiveRecord(matchId, {
      status: 'inProgress',
      match_time: 0,
      current_quarter: 1
    });

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
    await this.updateMatchesLiveRecord(matchId, {
      status: 'completed',
      match_time: matchTime,
      current_quarter: quarter,
      ...(finalScore && {
        home_score: finalScore.home,
        away_score: finalScore.away
      })
    });

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
    await this.updateMatchesLiveRecord(matchId, {
      current_quarter: quarter,
      match_time: matchTime
    });

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
        .maybeSingle();

      if (error) {
        console.error('❌ Failed to fetch live match state:', error);
        return null;
      }

      if (!data) {
        console.log('ℹ️ No matches_live record found for match:', matchId);
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
    await this.updateMatchesLiveRecord(matchId, { status });
  }

  // Update match time and quarter
  async updateMatchTime(matchId: string, matchTime: number, currentQuarter: number): Promise<void> {
    await this.updateMatchesLiveRecord(matchId, {
      match_time: matchTime,
      current_quarter: currentQuarter
    });
  }
}

export const matchEventLogger = MatchEventLogger.getInstance();