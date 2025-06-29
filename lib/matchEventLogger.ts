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

interface MatchData {
  match_key: string | null;
  home_team: string;
  away_team: string;
  club_logo_url: string | null;
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

  private async getMatchData(matchId: string): Promise<MatchData | null> {
    try {
      console.log('🔍 Fetching match data for:', matchId);
      
      // Fetch match data with club logo from clubs table
      const { data, error } = await supabase
        .from('matches')
        .select(`
          match_key, 
          home_team, 
          away_team,
          teams!inner(
            clubs!inner(
              logo_url
            )
          )
        `)
        .eq('id', matchId)
        .single();

      if (error) {
        console.error('❌ Error fetching match data:', error);
        return null;
      }

      if (!data) {
        console.error('❌ No match data found for:', matchId);
        return null;
      }

      // Extract club logo URL from the nested structure
      const clubLogoUrl = data.teams?.clubs?.logo_url || null;

      const matchData: MatchData = {
        match_key: data.match_key,
        home_team: data.home_team,
        away_team: data.away_team,
        club_logo_url: clubLogoUrl
      };

      console.log('✅ Match data fetched:', matchData);
      return matchData;
    } catch (error) {
      console.error('💥 Exception fetching match data:', error);
      return null;
    }
  }

  private async ensureMatchesLiveRecord(matchId: string): Promise<boolean> {
    try {
      // First check if record already exists
      const { data: existingRecord } = await supabase
        .from('matches_live')
        .select('id')
        .eq('match_id', matchId)
        .single();

      if (existingRecord) {
        console.log('✅ matches_live record already exists');
        return true;
      }

      // Get match data for creating the record
      const matchData = await this.getMatchData(matchId);
      if (!matchData) {
        console.error('❌ Cannot create matches_live record: match data not found');
        return false;
      }

      // Create new matches_live record
      const { error: insertError } = await supabase
        .from('matches_live')
        .insert({
          match_id: matchId,
          status: 'inProgress',
          current_quarter: 1,
          home_score: 0,
          away_score: 0,
          match_key: matchData.match_key,
          home_team: matchData.home_team,
          away_team: matchData.away_team,
          club_logo_url: matchData.club_logo_url,
          updated_at: new Date().toISOString()
        });

      if (insertError) {
        console.error('❌ Failed to create matches_live record:', insertError);
        return false;
      }

      console.log('✅ Created new matches_live record');
      return true;
    } catch (error) {
      console.error('💥 Exception ensuring matches_live record:', error);
      return false;
    }
  }

  private async updateMatchesLiveRecord(
    matchId: string, 
    updates: Partial<MatchesLive>
  ): Promise<boolean> {
    try {
      // Ensure the matches_live record exists first
      const recordExists = await this.ensureMatchesLiveRecord(matchId);
      if (!recordExists) {
        throw new Error(`Failed to ensure matches_live record exists for match ${matchId}`);
      }

      // Update the record
      const { error } = await supabase
        .from('matches_live')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('match_id', matchId);

      if (error) {
        console.error('❌ Failed to update matches_live record:', error);
        return false;
      }

      console.log('✅ Updated matches_live record successfully');
      return true;
    } catch (error) {
      console.error('💥 Exception updating matches_live record:', error);
      return false;
    }
  }

  async logEvent(event: MatchEventLog): Promise<void> {
    console.log('📝 Logging match event:', event);
    
    try {
      // Ensure match_id is a valid UUID
      const matchId = typeof event.match_id === 'string' 
        ? event.match_id 
        : event.match_id.toString();

      // Update matches_live record
      await this.updateMatchesLiveRecord(matchId, {
        current_quarter: event.quarter,
      });

      console.log('✅ Match event logged successfully');
    } catch (error) {
      console.error('💥 Exception logging match event:', error);
      throw error;
    }
  }

  async getMatchEvents(matchId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('matches_live')
        .select('*')
        .eq('match_id', matchId);

      if (error) {
        console.error('❌ Failed to fetch match events:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('💥 Exception fetching match events:', error);
      return [];
    }
  }

  async getEventsByAction(matchId: string, action: string): Promise<any[]> {
    console.warn('⚠️ getEventsByAction not implemented for matches_live table');
    return [];
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
    // Update the live match record with new scores
    await this.updateMatchesLiveRecord(matchId, {
      home_score: homeScore,
      away_score: awayScore,
      current_quarter: quarter
    });

    const scoreDiff = {
      home: homeScore - previousHomeScore,
      away: awayScore - previousAwayScore
    };

    let description = `Score updated: ${homeScore}-${awayScore}`;
    if (teamScored) {
      const diff = teamScored === 'home' ? scoreDiff.home : scoreDiff.away;
      description = `${teamScored === 'home' ? 'Home' : 'Away'} team score ${diff > 0 ? 'increased' : 'decreased'} by ${Math.abs(diff)}. New score: ${homeScore}-${awayScore}`;
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
      const matchData = await this.getMatchData(matchId);
      if (!matchData) {
        console.error('❌ Cannot create matches_live record: match data not found');
        return false;
      }

      const { error } = await supabase
        .from('matches_live')
        .insert({
          match_id: matchId,
          status: status,
          current_quarter: 1,
          home_score: 0,
          away_score: 0,
          match_key: matchData.match_key,
          home_team: matchData.home_team,
          away_team: matchData.away_team,
          club_logo_url: matchData.club_logo_url,
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

  // Get events for a match
  async getMatchEvents(matchId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('matches_live_events')
        .select('*')
        .eq('match_id', matchId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('❌ Failed to fetch match events:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('💥 Exception fetching match events:', error);
      return [];
    }
  }

  // Get events by action type
  async getEventsByAction(matchId: string, action: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('matches_live_events')
        .select('*')
        .eq('match_id', matchId)
        .eq('action', action)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('❌ Failed to fetch events by action:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('💥 Exception fetching events by action:', error);
      return [];
    }
  }

  // Get match events summary using the database function
  async getMatchEventsSummary(matchId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .rpc('get_match_events_summary', { match_uuid: matchId });

      if (error) {
        console.error('❌ Failed to fetch match events summary:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('💥 Exception fetching match events summary:', error);
      return [];
    }
  }

  // Get player event statistics using the database function
  async getPlayerEventStats(matchId: string, playerId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .rpc('get_player_event_stats', { 
          match_uuid: matchId, 
          player_uuid: playerId 
        });

      if (error) {
        console.error('❌ Failed to fetch player event stats:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('💥 Exception fetching player event stats:', error);
      return [];
    }
  }
}

export const matchEventLogger = MatchEventLogger.getInstance();