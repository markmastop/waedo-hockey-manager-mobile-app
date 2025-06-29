import { supabase } from '@/lib/supabase';
import { Player } from '@/types/database';
import { MatchesLive } from '@/types/database';

export interface MatchEventLog {
  match_id: string;
  player_id?: string;
  action: 'swap' | 'goal' | 'card' | 'substitution' | 'match_start' | 'match_end' | 'quarter_start' | 'quarter_end' | 'formation_change' | 'player_selection' | 'timeout' | 'injury' | 'penalty_corner' | 'penalty_stroke' | 'green_card' | 'yellow_card' | 'red_card' | 'score_change';
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

  private async checkDatabaseSchema(): Promise<boolean> {
    try {
      console.log('🔍 Checking database schema...');
      
      // Check if the check_matches_live_schema function exists and use it
      const { data, error } = await supabase
        .rpc('check_matches_live_schema');

      if (error) {
        console.warn('⚠️ Schema check function not available:', error.message);
        return true; // Assume schema is correct if we can't check
      }

      console.log('✅ Database schema check:', data);
      
      // Check if events column exists
      const hasEventsColumn = data?.some((col: any) => col.column_name === 'events');
      if (!hasEventsColumn) {
        console.error('❌ Events column missing from matches_live table');
        return false;
      }

      return true;
    } catch (error) {
      console.warn('⚠️ Could not check database schema:', error);
      return true; // Assume schema is correct if we can't check
    }
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
      // Check database schema first
      const schemaOk = await this.checkDatabaseSchema();
      if (!schemaOk) {
        console.error('❌ Database schema check failed');
        return false;
      }

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

      // Create new matches_live record with all required columns
      const insertData = {
        match_id: matchId,
        status: 'inProgress' as const,
        current_quarter: 1,
        match_time: 0,
        home_score: 0,
        away_score: 0,
        match_key: matchData.match_key,
        home_team: matchData.home_team,
        away_team: matchData.away_team,
        club_logo_url: matchData.club_logo_url,
        events: [],
        last_event: null,
        updated_at: new Date().toISOString()
      };

      console.log('📝 Creating matches_live record with data:', insertData);

      const { error: insertError } = await supabase
        .from('matches_live')
        .insert(insertData);

      if (insertError) {
        console.error('❌ Failed to create matches_live record:', insertError);
        console.error('Insert data was:', insertData);
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

      // Prepare updates with timestamp
      const updateData = {
        ...updates,
        updated_at: new Date().toISOString()
      };

      console.log('📝 Updating matches_live record with:', updateData);

      // Update the record
      const { error } = await supabase
        .from('matches_live')
        .update(updateData)
        .eq('match_id', matchId);

      if (error) {
        console.error('❌ Failed to update matches_live record:', error);
        console.error('Update data was:', updateData);
        return false;
      }

      console.log('✅ Updated matches_live record successfully');
      return true;
    } catch (error) {
      console.error('💥 Exception updating matches_live record:', error);
      return false;
    }
  }

  private async addEventToMatchesLive(matchId: string, event: MatchEventLog): Promise<boolean> {
    try {
      // Prepare event data for storage
      const eventData = {
        id: crypto.randomUUID(),
        action: event.action,
        description: event.description,
        match_time: event.match_time,
        quarter: event.quarter,
        player_id: event.player_id,
        metadata: event.metadata,
        timestamp: new Date().toISOString()
      };

      console.log('📝 Adding event to matches_live:', eventData);

      // Use the database function to add the event - fix parameter order
      const { data, error } = await supabase
        .rpc('add_match_event', {
          match_uuid: matchId,
          event_data: eventData
        });

      if (error) {
        console.error('❌ Failed to add event to matches_live:', error);
        console.error('Event data was:', eventData);
        
        // If the function doesn't exist, try direct update as fallback
        if (error.message?.includes('function') || error.message?.includes('does not exist')) {
          console.log('🔄 Trying direct update as fallback...');
          return await this.addEventDirectly(matchId, eventData);
        }
        
        return false;
      }

      console.log('✅ Event added to matches_live successfully');
      return true;
    } catch (error) {
      console.error('💥 Exception adding event to matches_live:', error);
      return false;
    }
  }

  private async addEventDirectly(matchId: string, eventData: any): Promise<boolean> {
    try {
      // Get current events
      const { data: currentRecord, error: fetchError } = await supabase
        .from('matches_live')
        .select('events')
        .eq('match_id', matchId)
        .single();

      if (fetchError) {
        console.error('❌ Failed to fetch current events:', fetchError);
        return false;
      }

      const currentEvents = currentRecord?.events || [];
      const newEvents = [...currentEvents, eventData];

      // Update with new events
      const { error: updateError } = await supabase
        .from('matches_live')
        .update({
          events: newEvents,
          last_event: eventData,
          updated_at: new Date().toISOString()
        })
        .eq('match_id', matchId);

      if (updateError) {
        console.error('❌ Failed to update events directly:', updateError);
        return false;
      }

      console.log('✅ Event added directly to matches_live');
      return true;
    } catch (error) {
      console.error('💥 Exception adding event directly:', error);
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

      // Update matches_live record with current match time and quarter
      await this.updateMatchesLiveRecord(matchId, {
        current_quarter: event.quarter,
        match_time: event.match_time, // Update match time with each event
      });

      // Add event to the events JSON array and update last_event
      await this.addEventToMatchesLive(matchId, event);

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
        .select('events')
        .eq('match_id', matchId)
        .single();

      if (error) {
        console.error('❌ Failed to fetch match events:', error);
        return [];
      }

      return data?.events || [];
    } catch (error) {
      console.error('💥 Exception fetching match events:', error);
      return [];
    }
  }

  async getRecentMatchEvents(matchId: string, limit: number = 10): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .rpc('get_recent_match_events', {
          match_uuid: matchId,
          event_limit: limit
        });

      if (error) {
        console.error('❌ Failed to fetch recent match events:', error);
        // Fallback to direct query
        return await this.getMatchEventsDirectly(matchId, limit);
      }

      return data || [];
    } catch (error) {
      console.error('💥 Exception fetching recent match events:', error);
      return [];
    }
  }

  private async getMatchEventsDirectly(matchId: string, limit: number = 10): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('matches_live')
        .select('events')
        .eq('match_id', matchId)
        .single();

      if (error || !data?.events) {
        return [];
      }

      const events = Array.isArray(data.events) ? data.events : [];
      return events
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit);
    } catch (error) {
      console.error('💥 Exception in direct events fetch:', error);
      return [];
    }
  }

  async getEventsByAction(matchId: string, action: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .rpc('get_match_events_by_action', {
          match_uuid: matchId,
          action_type: action
        });

      if (error) {
        console.error('❌ Failed to fetch events by action:', error);
        // Fallback to direct query
        const allEvents = await this.getMatchEventsDirectly(matchId, 1000);
        return allEvents.filter(event => event.action === action);
      }

      return data || [];
    } catch (error) {
      console.error('💥 Exception fetching events by action:', error);
      return [];
    }
  }

  async getLastEvent(matchId: string): Promise<any | null> {
    try {
      const { data, error } = await supabase
        .from('matches_live')
        .select('last_event')
        .eq('match_id', matchId)
        .single();

      if (error) {
        console.error('❌ Failed to fetch last event:', error);
        return null;
      }

      return data?.last_event || null;
    } catch (error) {
      console.error('💥 Exception fetching last event:', error);
      return null;
    }
  }

  async clearMatchEvents(matchId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .rpc('clear_match_events', {
          match_uuid: matchId
        });

      if (error) {
        console.error('❌ Failed to clear match events:', error);
        // Fallback to direct update
        const { error: directError } = await supabase
          .from('matches_live')
          .update({
            events: [],
            last_event: null,
            updated_at: new Date().toISOString()
          })
          .eq('match_id', matchId);

        if (directError) {
          console.error('❌ Failed to clear events directly:', directError);
          return false;
        }
      }

      console.log('✅ Match events cleared successfully');
      return true;
    } catch (error) {
      console.error('💥 Exception clearing match events:', error);
      return false;
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
    // Update the live match record with new scores and current match time
    await this.updateMatchesLiveRecord(matchId, {
      home_score: homeScore,
      away_score: awayScore,
      current_quarter: quarter,
      match_time: matchTime // Include match time in score updates
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
          match_time: 0,
          home_score: 0,
          away_score: 0,
          match_key: matchData.match_key,
          home_team: matchData.home_team,
          away_team: matchData.away_team,
          club_logo_url: matchData.club_logo_url,
          events: [],
          last_event: null,
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
    // Update status to completed when match ends
    await this.updateMatchesLiveRecord(matchId, {
      status: 'completed',
      match_time: matchTime,
      current_quarter: quarter
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

  // Method to update match time without logging an event (for timer updates)
  async updateMatchTime(matchId: string, matchTime: number, quarter: number): Promise<void> {
    try {
      await this.updateMatchesLiveRecord(matchId, {
        match_time: matchTime,
        current_quarter: quarter
      });
    } catch (error) {
      console.error('💥 Exception updating match time:', error);
    }
  }

  // Method to update match status
  async updateMatchStatus(matchId: string, status: 'upcoming' | 'inProgress' | 'paused' | 'completed', matchTime?: number, quarter?: number): Promise<void> {
    try {
      const updates: Partial<MatchesLive> = { status };
      if (matchTime !== undefined) updates.match_time = matchTime;
      if (quarter !== undefined) updates.current_quarter = quarter;
      
      await this.updateMatchesLiveRecord(matchId, updates);
    } catch (error) {
      console.error('💥 Exception updating match status:', error);
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