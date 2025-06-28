import { supabase } from '@/lib/supabase';
import { Player } from '@/types/database';

export interface MatchEventLog {
  match_id: string;
  player_id?: string;
  action: 'swap' | 'goal' | 'card' | 'substitution' | 'match_start' | 'match_end' | 'quarter_start' | 'quarter_end' | 'formation_change' | 'player_selection';
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
      const { error } = await supabase
        .from('matches_live_events')
        .insert({
          match_id: event.match_id,
          player_id: event.player_id,
          action: event.action,
          description: event.description,
          match_time: event.match_time,
          quarter: event.quarter,
          metadata: event.metadata || {},
        });

      if (error) {
        console.error('❌ Failed to log match event:', error);
        // Add to queue for retry
        this.eventQueue.push(event);
        this.processQueue();
      } else {
        console.log('✅ Match event logged successfully');
      }
    } catch (error) {
      console.error('💥 Exception logging match event:', error);
      this.eventQueue.push(event);
      this.processQueue();
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
          const { error } = await supabase
            .from('matches_live_events')
            .insert({
              match_id: event.match_id,
              player_id: event.player_id,
              action: event.action,
              description: event.description,
              match_time: event.match_time,
              quarter: event.quarter,
              metadata: event.metadata || {},
            });

          if (error) {
            console.error('❌ Failed to process queued event:', error);
            // Put it back at the end of the queue
            this.eventQueue.push(event);
            break;
          } else {
            console.log('✅ Queued event processed successfully');
          }
        } catch (error) {
          console.error('💥 Exception processing queued event:', error);
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
    await this.logEvent({
      match_id: matchId,
      player_id: player.id,
      action: 'card',
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

  async logMatchStart(matchId: string): Promise<void> {
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
}

export const matchEventLogger = MatchEventLogger.getInstance();