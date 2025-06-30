import { supabase } from '@/lib/supabase';
import { Player } from '@/types/database';
import { MatchesLive } from '@/types/database';
import { isValidUUID } from "@/lib/validation";

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
  private retryAttempts = 3;
  private retryDelay = 1000; // 1 second
  
  // Event deduplication and throttling
  private recentEvents: Map<string, number> = new Map(); // eventKey -> timestamp
  private eventThrottleMs = 2000; // 2 seconds between same events
  private pendingEvents: Set<string> = new Set(); // Track events currently being processed

  static getInstance(): MatchEventLogger {
    if (!MatchEventLogger.instance) {
      MatchEventLogger.instance = new MatchEventLogger();
    }
    return MatchEventLogger.instance;
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateEventKey(event: MatchEventLog): string {
    // Create a unique key for this event to prevent duplicates
    const baseKey = `${event.match_id}-${event.action}-${event.match_time}-${event.quarter}`;
    
    // For player-specific events, include player ID
    if (event.player_id) {
      return `${baseKey}-${event.player_id}`;
    }
    
    // For description-specific events, include a hash of the description
    return `${baseKey}-${event.description.slice(0, 20)}`;
  }

  private isEventDuplicate(event: MatchEventLog): boolean {
    const eventKey = this.generateEventKey(event);
    const now = Date.now();
    const lastEventTime = this.recentEvents.get(eventKey);
    
    // Check if this exact event happened recently
    if (lastEventTime && (now - lastEventTime) < this.eventThrottleMs) {
      console.log(`🚫 Duplicate event detected and blocked: ${eventKey}`);
      return true;
    }
    
    // Check if this event is currently being processed
    if (this.pendingEvents.has(eventKey)) {
      console.log(`🚫 Event already being processed: ${eventKey}`);
      return true;
    }
    
    return false;
  }

  private markEventAsProcessed(event: MatchEventLog): void {
    const eventKey = this.generateEventKey(event);
    const now = Date.now();
    
    // Mark as recently processed
    this.recentEvents.set(eventKey, now);
    
    // Clean up old entries (older than throttle time)
    for (const [key, timestamp] of this.recentEvents.entries()) {
      if (now - timestamp > this.eventThrottleMs * 2) {
        this.recentEvents.delete(key);
      }
    }
  }

  private shouldLogEvent(event: MatchEventLog): boolean {
    // Never log player selection events - these are UI interactions, not match events
    if (event.action === 'player_selection') {
      console.log(`🚫 Skipping player selection event - not a match event`);
      return false;
    }
    
    // Only log actual match events that should be recorded
    const allowedActions = [
      'goal', 'card', 'substitution', 'swap', 
      'match_start', 'match_end', 'quarter_start', 'quarter_end',
      'timeout', 'injury', 'penalty_corner', 'penalty_stroke',
      'green_card', 'yellow_card', 'red_card', 'score_change'
    ];
    
    if (!allowedActions.includes(event.action)) {
      console.log(`🚫 Skipping event with action: ${event.action} - not in allowed list`);
      return false;
    }
    
    return true;
  }

  private async retryOperation<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxRetries: number = this.retryAttempts
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 ${operationName} - Attempt ${attempt}/${maxRetries}`);
        const result = await operation();
        if (attempt > 1) {
          console.log(`✅ ${operationName} succeeded on attempt ${attempt}`);
        }
        return result;
      } catch (error) {
        lastError = error as Error;
        console.warn(`⚠️ ${operationName} failed on attempt ${attempt}:`, error);
        
        if (attempt < maxRetries) {
          const delayMs = this.retryDelay * attempt; // Exponential backoff
          console.log(`⏳ Retrying ${operationName} in ${delayMs}ms...`);
          await this.delay(delayMs);
        }
      }
    }
    
    console.error(`❌ ${operationName} failed after ${maxRetries} attempts:`, lastError);
    throw lastError;
  }

  private validateMatchId(matchId: string): boolean {
    if (!matchId || typeof matchId !== 'string') {
      console.error('❌ Invalid match ID:', matchId);
      return false;
    }
    
    if (!isValidUUID(matchId)) {
      console.error('❌ Invalid UUID format for match ID:', matchId);
      return false;
    }
    
    return true;
  }

  private validateEventData(event: MatchEventLog): boolean {
    if (!event.action || !event.description) {
      console.error('❌ Invalid event data: missing action or description', event);
      return false;
    }
    
    if (typeof event.match_time !== 'number' || event.match_time < 0) {
      console.error('❌ Invalid match time:', event.match_time);
      return false;
    }
    
    if (typeof event.quarter !== 'number' || event.quarter < 1 || event.quarter > 4) {
      console.error('❌ Invalid quarter:', event.quarter);
      return false;
    }
    
    return true;
  }

  private async getMatchData(matchId: string): Promise<MatchData | null> {
    return this.retryOperation(async () => {
      console.log('🔍 Fetching match data for:', matchId);
      
      const { data, error } = await supabase
        .from('matches')
        .select(`
          match_key, 
          home_team, 
          away_team,
          teams!inner(
            clubs(
              logo_url
            )
          )
        `)
        .eq('id', matchId)
        .single();

      if (error) {
        throw new Error(`Failed to fetch match data: ${error.message}`);
      }

      if (!data) {
        throw new Error(`No match data found for ID: ${matchId}`);
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
    }, 'getMatchData');
  }

  private async ensureMatchesLiveRecord(matchId: string): Promise<boolean> {
    return this.retryOperation(async () => {
      // First check if record already exists
      const { data: existingRecord, error: checkError } = await supabase
        .from('matches_live')
        .select('id, events')
        .eq('match_id', matchId)
        .single();

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw new Error(`Failed to check existing record: ${checkError.message}`);
      }

      if (existingRecord) {
        console.log('✅ matches_live record already exists');
        
        // Ensure events column is properly initialized
        if (!existingRecord.events) {
          const { error: updateError } = await supabase
            .from('matches_live')
            .update({ events: [] })
            .eq('match_id', matchId);
            
          if (updateError) {
            throw new Error(`Failed to initialize events array: ${updateError.message}`);
          }
        }
        
        return true;
      }

      // Get match data for creating the record
      const matchData = await this.getMatchData(matchId);
      if (!matchData) {
        throw new Error('Cannot create matches_live record: match data not found');
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
        throw new Error(`Failed to create matches_live record: ${insertError.message}`);
      }

      console.log('✅ Created new matches_live record');
      return true;
    }, 'ensureMatchesLiveRecord');
  }

  async logEvent(event: MatchEventLog): Promise<void> {
    console.log('📝 Attempting to log match event:', event);
    
    // First check if this event should be logged at all
    if (!this.shouldLogEvent(event)) {
      return; // Silently skip events that shouldn't be logged
    }
    
    // Validate input data
    if (!this.validateMatchId(event.match_id)) {
      throw new Error('Invalid match ID provided');
    }
    
    if (!this.validateEventData(event)) {
      throw new Error('Invalid event data provided');
    }
    
    // Check for duplicates
    if (this.isEventDuplicate(event)) {
      console.log('🚫 Skipping duplicate event');
      return; // Silently skip duplicate events
    }
    
    const eventKey = this.generateEventKey(event);
    
    try {
      // Mark event as being processed
      this.pendingEvents.add(eventKey);
      
      await this.retryOperation(async () => {
        // Ensure the matches_live record exists first
        const recordExists = await this.ensureMatchesLiveRecord(event.match_id);
        if (!recordExists) {
          throw new Error(`Failed to ensure matches_live record exists for match ${event.match_id}`);
        }

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

        // Get current events and append new event in a single transaction-like operation
        const { data: currentRecord, error: fetchError } = await supabase
          .from('matches_live')
          .select('events')
          .eq('match_id', event.match_id)
          .single();

        if (fetchError) {
          throw new Error(`Failed to fetch current events: ${fetchError.message}`);
        }

        const currentEvents = Array.isArray(currentRecord?.events) ? currentRecord.events : [];
        const newEvents = [...currentEvents, eventData];

        // Single atomic update operation
        const { error: updateError } = await supabase
          .from('matches_live')
          .update({
            events: newEvents,
            last_event: eventData,
            current_quarter: event.quarter,
            match_time: event.match_time,
            updated_at: new Date().toISOString()
          })
          .eq('match_id', event.match_id);

        if (updateError) {
          throw new Error(`Failed to update matches_live: ${updateError.message}`);
        }

        console.log('✅ Event added to matches_live successfully');
      }, 'logEvent');

      // Mark event as successfully processed
      this.markEventAsProcessed(event);
      console.log('✅ Match event logged successfully');
      
    } catch (error) {
      console.error('💥 Failed to log match event:', error);
      
      // Add to queue for retry if it's a transient error
      if (this.isTransientError(error as Error)) {
        console.log('📋 Adding event to retry queue');
        this.eventQueue.push(event);
        this.processQueue(); // Process queue asynchronously
      }
      
      throw error;
    } finally {
      // Always remove from pending events
      this.pendingEvents.delete(eventKey);
    }
  }

  private isTransientError(error: Error): boolean {
    const transientErrorPatterns = [
      'connection',
      'timeout',
      'network',
      'temporary',
      'rate limit',
      'too many requests'
    ];
    
    const errorMessage = error.message.toLowerCase();
    return transientErrorPatterns.some(pattern => errorMessage.includes(pattern));
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
          console.log('✅ Successfully processed queued event');
        } catch (error) {
          console.error('❌ Failed to process queued event:', error);
          // Put the event back at the end of the queue for later retry
          this.eventQueue.push(event);
          break; // Stop processing to avoid infinite loops
        }
      }
    }

    this.isProcessing = false;
  }

  async getMatchEvents(matchId: string): Promise<any[]> {
    if (!this.validateMatchId(matchId)) {
      return [];
    }

    return this.retryOperation(async () => {
      const { data, error } = await supabase
        .from('matches_live')
        .select('events')
        .eq('match_id', matchId)
        .single();

      if (error) {
        throw new Error(`Failed to fetch match events: ${error.message}`);
      }

      return Array.isArray(data?.events) ? data.events : [];
    }, 'getMatchEvents');
  }

  async getRecentMatchEvents(matchId: string, limit: number = 10): Promise<any[]> {
    if (!this.validateMatchId(matchId)) {
      return [];
    }

    try {
      const events = await this.getMatchEvents(matchId);
      return events
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit);
    } catch (error) {
      console.error('💥 Exception fetching recent match events:', error);
      return [];
    }
  }

  async getEventsByAction(matchId: string, action: string): Promise<any[]> {
    if (!this.validateMatchId(matchId)) {
      return [];
    }

    try {
      const events = await this.getMatchEvents(matchId);
      return events.filter(event => event.action === action);
    } catch (error) {
      console.error('💥 Exception fetching events by action:', error);
      return [];
    }
  }

  async getLastEvent(matchId: string): Promise<any | null> {
    if (!this.validateMatchId(matchId)) {
      return null;
    }

    return this.retryOperation(async () => {
      const { data, error } = await supabase
        .from('matches_live')
        .select('last_event')
        .eq('match_id', matchId)
        .single();

      if (error) {
        throw new Error(`Failed to fetch last event: ${error.message}`);
      }

      return data?.last_event || null;
    }, 'getLastEvent');
  }

  async clearMatchEvents(matchId: string): Promise<boolean> {
    if (!this.validateMatchId(matchId)) {
      return false;
    }

    return this.retryOperation(async () => {
      const { error } = await supabase
        .from('matches_live')
        .update({
          events: [],
          last_event: null,
          updated_at: new Date().toISOString()
        })
        .eq('match_id', matchId);

      if (error) {
        throw new Error(`Failed to clear events: ${error.message}`);
      }

      console.log('✅ Match events cleared successfully');
      return true;
    }, 'clearMatchEvents');
  }

  // Helper method to update scores separately when needed
  private async updateMatchScores(
    matchId: string, 
    homeScore: number, 
    awayScore: number, 
    matchTime: number, 
    quarter: number
  ): Promise<void> {
    return this.retryOperation(async () => {
      const { error } = await supabase
        .from('matches_live')
        .update({
          home_score: homeScore,
          away_score: awayScore,
          match_time: matchTime,
          current_quarter: quarter,
          updated_at: new Date().toISOString()
        })
        .eq('match_id', matchId);

      if (error) {
        throw new Error(`Failed to update match scores: ${error.message}`);
      }
    }, 'updateMatchScores');
  }

  // Method to update match time without logging an event (for timer updates)
  async updateMatchTime(matchId: string, matchTime: number, quarter: number): Promise<void> {
    if (!this.validateMatchId(matchId)) {
      throw new Error('Invalid match ID');
    }

    return this.retryOperation(async () => {
      const { error } = await supabase
        .from('matches_live')
        .update({
          match_time: matchTime,
          current_quarter: quarter,
          updated_at: new Date().toISOString()
        })
        .eq('match_id', matchId);

      if (error) {
        throw new Error(`Failed to update match time: ${error.message}`);
      }
    }, 'updateMatchTime');
  }

  // Method to update match status
  async updateMatchStatus(matchId: string, status: 'upcoming' | 'inProgress' | 'paused' | 'completed', matchTime?: number, quarter?: number): Promise<void> {
    if (!this.validateMatchId(matchId)) {
      throw new Error('Invalid match ID');
    }

    return this.retryOperation(async () => {
      const updates: Partial<MatchesLive> = { 
        status,
        updated_at: new Date().toISOString()
      };
      if (matchTime !== undefined) updates.match_time = matchTime;
      if (quarter !== undefined) updates.current_quarter = quarter;
      
      const { error } = await supabase
        .from('matches_live')
        .update(updates)
        .eq('match_id', matchId);

      if (error) {
        throw new Error(`Failed to update match status: ${error.message}`);
      }
    }, 'updateMatchStatus');
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
    console.log('🥅 Logging goal event for player:', player.name);
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

    // Update scores in the matches_live record first
    await this.updateMatchScores(matchId, homeScore, awayScore, matchTime, quarter);

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

  // Note: This method is intentionally removed to prevent unwanted logging
  // Player selection should NOT trigger match events
  // async logPlayerSelection() - REMOVED

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
    if (!this.validateMatchId(matchId)) {
      return false;
    }

    try {
      const matchData = await this.getMatchData(matchId);
      if (!matchData) {
        console.error('❌ Cannot create matches_live record: match data not found');
        return false;
      }

      return this.retryOperation(async () => {
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
          throw new Error(`Failed to create matches_live record: ${error.message}`);
        }

        return true;
      }, 'createMatchesLiveRecord');
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
    await this.updateMatchStatus(matchId, 'completed', matchTime, quarter);

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

  // Get match events summary using the database function
  async getMatchEventsSummary(matchId: string): Promise<any[]> {
    if (!this.validateMatchId(matchId)) {
      return [];
    }

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
    if (!this.validateMatchId(matchId)) {
      return [];
    }

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

  // Method to clear recent events cache (useful for testing)
  clearEventCache(): void {
    this.recentEvents.clear();
    this.pendingEvents.clear();
    console.log('🧹 Event cache cleared');
  }
}

export const matchEventLogger = MatchEventLogger.getInstance();