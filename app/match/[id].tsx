import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Player, Substitution, MatchEvent, PlayerStats, FormationPosition } from '@/types/database';
import { Match } from '@/types/match';
import { LivePlayerCard } from '@/components/LivePlayerCard';
import { LiveMatchTimer } from '@/components/LiveMatchTimer';
import { MatchEventLogger } from '@/components/MatchEventLogger';
import { PositionCard } from '../../components/PositionCard';
import { ArrowLeft, Users, ArrowUpDown, Star, Activity, ChartBar as BarChart3, Target, TriangleAlert as AlertTriangle, Grid3x3 as Grid3X3 } from 'lucide-react-native';

export default function LiveMatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [match, setMatch] = useState<Match | null>(null);
  const [formations, setFormations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null);
  const [isSubstituting, setIsSubstituting] = useState(false);
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>([]);
  const [matchEvents, setMatchEvents] = useState<MatchEvent[]>([]);
  const [activeTab, setActiveTab] = useState<'positions' | 'lineup' | 'events' | 'stats'>('positions');

  const convertPlayersDataToArray = (playersData: any): Player[] => {
    if (!playersData) return [];
    
    if (Array.isArray(playersData)) {
      return playersData.filter(player => 
        player && typeof player === 'object' && player.id && player.name
      );
    }
    
    if (typeof playersData === 'object') {
      const players: Player[] = [];
      Object.keys(playersData).forEach(position => {
        const playerData = playersData[position];
        if (playerData && typeof playerData === 'object' && playerData.id && playerData.name) {
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
  };

  const initializePlayerStats = (lineup: Player[], reserves: Player[]): PlayerStats[] => {
    const allPlayers = [...lineup, ...reserves];
    return allPlayers.map(player => ({
      playerId: player.id,
      timeOnField: lineup.some(p => p.id === player.id) ? 0 : 0,
      quartersPlayed: [],
      substitutions: 0,
      goals: 0,
      assists: 0,
      cards: 0,
    }));
  };

  const fetchFormations = async () => {
    try {
      const { data, error } = await supabase
        .from('formations')
        .select('*')
        .order('id');

      if (error) throw error;
      setFormations(data || []);
    } catch (error) {
      console.error('Error fetching formations:', error);
    }
  };

  const fetchMatch = async () => {
    try {
      const { data, error } = await supabase
        .from('matches')
        .select(`
          *,
          teams (
            name
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      
      const lineupArray = convertPlayersDataToArray(data.lineup);
      const reservePlayersArray = convertPlayersDataToArray(data.reserve_players);
      const substitutionsArray = Array.isArray(data.substitutions) ? data.substitutions : [];
      const eventsArray = Array.isArray(data.match_events) ? data.match_events : [];
      const statsArray = Array.isArray(data.player_stats) ? data.player_stats : 
        initializePlayerStats(lineupArray, reservePlayersArray);
      const quarterTimesArray = Array.isArray(data.quarter_times) ? data.quarter_times : [0, 0, 0, 0];
      
      const matchData = {
        ...data,
        lineup: lineupArray,
        reserve_players: reservePlayersArray,
        substitutions: substitutionsArray,
        match_events: eventsArray,
        player_stats: statsArray,
        quarter_times: quarterTimesArray,
        home_score: data.home_score || 0,
        away_score: data.away_score || 0,
        formation: data.formation || '',
        substitution_schedule: data.substitution_schedule || {},
      };
      
      setMatch(matchData);
      setPlayerStats(statsArray);
      setMatchEvents(eventsArray);
    } catch (error) {
      console.error('Error fetching match:', error);
      Alert.alert('Fout', 'Kon wedstrijdgegevens niet laden');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchFormations();
      fetchMatch();
    }
  }, [id]);

  const updatePlayerStats = (newStats: PlayerStats[]) => {
    setPlayerStats(newStats);
    if (match) {
      updateMatch({ player_stats: newStats });
    }
  };

  const addMatchEvent = (event: Omit<MatchEvent, 'id' | 'timestamp'>) => {
    const newEvent: MatchEvent = {
      ...event,
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
    };

    const updatedEvents = [...matchEvents, newEvent];
    setMatchEvents(updatedEvents);

    // Update player stats based on event
    if (event.player && event.type === 'goal') {
      const updatedStats = playerStats.map(stat => 
        stat.playerId === event.player!.id 
          ? { ...stat, goals: (stat.goals || 0) + 1 }
          : stat
      );
      updatePlayerStats(updatedStats);
    }

    if (event.player && event.type === 'card') {
      const updatedStats = playerStats.map(stat => 
        stat.playerId === event.player!.id 
          ? { ...stat, cards: (stat.cards || 0) + 1 }
          : stat
      );
      updatePlayerStats(updatedStats);
    }

    if (match) {
      updateMatch({ match_events: updatedEvents });
    }
  };

  const updateMatch = async (updates: Partial<Match>) => {
    if (!match) return;

    try {
      const dbUpdates: any = {};
      Object.keys(updates).forEach(key => {
        dbUpdates[key] = updates[key as keyof Match];
      });

      const { error } = await supabase
        .from('matches')
        .update(dbUpdates)
        .eq('id', match.id);

      if (error) throw error;
      
      setMatch(prev => prev ? { ...prev, ...updates } : null);
    } catch (error) {
      console.error('Error updating match:', error);
      Alert.alert('Fout', 'Kon wedstrijd niet bijwerken');
    }
  };

  const startMatch = () => {
    const startEvent: MatchEvent = {
      id: Date.now().toString(),
      type: 'match_start',
      time: 0,
      quarter: 1,
      timestamp: new Date().toISOString(),
    };

    const quarterStartEvent: MatchEvent = {
      id: (Date.now() + 1).toString(),
      type: 'quarter_start',
      time: 0,
      quarter: 1,
      timestamp: new Date().toISOString(),
    };

    const newEvents = [...matchEvents, startEvent, quarterStartEvent];
    setMatchEvents(newEvents);

    // Mark all starting players as playing in quarter 1
    const updatedStats = playerStats.map(stat => {
      const isStarting = match?.lineup.some(p => p.id === stat.playerId);
      return isStarting 
        ? { ...stat, quartersPlayed: [1] }
        : stat;
    });
    updatePlayerStats(updatedStats);

    updateMatch({ 
      status: 'inProgress',
      match_events: newEvents,
      player_stats: updatedStats,
    });
  };

  const pauseMatch = () => {
    updateMatch({ status: 'paused' });
  };

  const resumeMatch = () => {
    updateMatch({ status: 'inProgress' });
  };

  const endMatch = () => {
    Alert.alert(
      'Wedstrijd Beëindigen',
      'Weet je zeker dat je deze wedstrijd wilt beëindigen?',
      [
        { text: 'Annuleren', style: 'cancel' },
        {
          text: 'Beëindigen',
          style: 'destructive',
          onPress: () => {
            const endEvent: MatchEvent = {
              id: Date.now().toString(),
              type: 'match_end',
              time: match?.match_time || 0,
              quarter: match?.current_quarter || 1,
              timestamp: new Date().toISOString(),
            };

            const newEvents = [...matchEvents, endEvent];
            setMatchEvents(newEvents);

            updateMatch({ 
              status: 'completed',
              match_events: newEvents,
            });
          },
        },
      ]
    );
  };

  const nextQuarter = () => {
    if (match && match.current_quarter < 4) {
      const newQuarter = match.current_quarter + 1;
      const currentQuarterTime = match.match_time - match.quarter_times.slice(0, match.current_quarter - 1).reduce((sum, time) => sum + time, 0);
      
      const quarterEndEvent: MatchEvent = {
        id: Date.now().toString(),
        type: 'quarter_end',
        time: match.match_time,
        quarter: match.current_quarter,
        timestamp: new Date().toISOString(),
      };

      const quarterStartEvent: MatchEvent = {
        id: (Date.now() + 1).toString(),
        type: 'quarter_start',
        time: match.match_time,
        quarter: newQuarter,
        timestamp: new Date().toISOString(),
      };

      const newEvents = [...matchEvents, quarterEndEvent, quarterStartEvent];
      setMatchEvents(newEvents);

      // Update quarter times
      const newQuarterTimes = [...match.quarter_times];
      newQuarterTimes[match.current_quarter - 1] = currentQuarterTime;

      // Mark all current field players as playing in the new quarter
      const updatedStats = playerStats.map(stat => {
        const isOnField = match.lineup.some(p => p.id === stat.playerId);
        return isOnField && !stat.quartersPlayed.includes(newQuarter)
          ? { ...stat, quartersPlayed: [...stat.quartersPlayed, newQuarter] }
          : stat;
      });

      updatePlayerStats(updatedStats);

      updateMatch({ 
        current_quarter: newQuarter,
        quarter_times: newQuarterTimes,
        match_events: newEvents,
        player_stats: updatedStats,
      });
    }
  };

  const handleTimeUpdate = (newTime: number) => {
    if (match) {
      // Update time on field for current players
      const updatedStats = playerStats.map(stat => {
        const isOnField = match.lineup.some(p => p.id === stat.playerId);
        return isOnField 
          ? { ...stat, timeOnField: stat.timeOnField + 1 }
          : stat;
      });
      setPlayerStats(updatedStats);
      
      updateMatch({ 
        match_time: newTime,
        player_stats: updatedStats,
      });
    }
  };

  const handlePositionPress = (position: FormationPosition) => {
    if (isSubstituting) {
      makePositionSubstitution(position);
    } else {
      setSelectedPosition(position.id);
      setIsSubstituting(true);
    }
  };

  const handlePlayerPress = (player: Player, isOnField: boolean) => {
    if (isSubstituting && selectedPosition) {
      makePlayerToPositionSubstitution(player, isOnField);
    } else {
      setSelectedPosition(null);
      setIsSubstituting(true);
    }
  };

  const makePositionSubstitution = (targetPosition: FormationPosition) => {
    if (!match || !selectedPosition) return;

    // Find current player in selected position
    const currentPlayer = getPlayerInPosition(selectedPosition);
    const targetPlayer = getPlayerInPosition(targetPosition.id);

    if (currentPlayer && targetPlayer) {
      // Swap positions
      const newLineup = match.lineup.map(player => {
        if (player.id === currentPlayer.id) {
          return { ...player, position: targetPosition.dutch_name };
        }
        if (player.id === targetPlayer.id) {
          return { ...player, position: getPositionName(selectedPosition) };
        }
        return player;
      });

      updateMatch({ lineup: newLineup });
    }

    setSelectedPosition(null);
    setIsSubstituting(false);
  };

  const makePlayerToPositionSubstitution = (player: Player, isOnField: boolean) => {
    if (!match || !selectedPosition) return;

    const newLineup = [...match.lineup];
    const newReservePlayers = [...match.reserve_players];
    const currentPositionPlayer = getPlayerInPosition(selectedPosition);

    if (isOnField && currentPositionPlayer) {
      // Swap field players
      const playerIndex = newLineup.findIndex(p => p.id === player.id);
      const currentIndex = newLineup.findIndex(p => p.id === currentPositionPlayer.id);
      
      if (playerIndex !== -1 && currentIndex !== -1) {
        const tempPosition = newLineup[playerIndex].position;
        newLineup[playerIndex] = { ...newLineup[playerIndex], position: newLineup[currentIndex].position };
        newLineup[currentIndex] = { ...newLineup[currentIndex], position: tempPosition };
      }
    } else if (!isOnField && currentPositionPlayer) {
      // Substitute bench player for field player
      const reserveIndex = newReservePlayers.findIndex(p => p.id === player.id);
      const fieldIndex = newLineup.findIndex(p => p.id === currentPositionPlayer.id);
      
      if (reserveIndex !== -1 && fieldIndex !== -1) {
        const positionName = getPositionName(selectedPosition);
        newLineup[fieldIndex] = { ...player, position: positionName };
        newReservePlayers[reserveIndex] = currentPositionPlayer;

        // Log substitution
        const substitution: Substitution = {
          time: match.match_time,
          quarter: match.current_quarter,
          playerIn: player,
          playerOut: currentPositionPlayer,
          timestamp: new Date().toISOString(),
        };

        const newSubstitutions = [...match.substitutions, substitution];
        updateMatch({
          lineup: newLineup,
          reserve_players: newReservePlayers,
          substitutions: newSubstitutions,
        });
      }
    }

    setSelectedPosition(null);
    setIsSubstituting(false);
  };

  const getPlayerInPosition = (positionId: string): Player | null => {
    if (!match) return null;
    const positionName = getPositionName(positionId);
    return match.lineup.find(player => player.position === positionName) || null;
  };

  const getPositionName = (positionId: string): string => {
    const formation = formations.find(f => f.id === match?.formation);
    if (!formation) return '';
    const position = formation.positions.find((p: FormationPosition) => p.id === positionId);
    return position?.dutch_name || '';
  };

  const getFormationPositions = (): FormationPosition[] => {
    if (!match?.formation) return [];
    const formation = formations.find(f => f.id === match.formation);
    return formation?.positions.sort((a: FormationPosition, b: FormationPosition) => a.order - b.order) || [];
  };

  const cancelSubstitution = () => {
    setSelectedPosition(null);
    setIsSubstituting(false);
  };

  const getPlayerStats = (playerId: string): PlayerStats | undefined => {
    return playerStats.find(stat => stat.playerId === playerId);
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Wedstrijd laden...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!match) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Wedstrijd niet gevonden</Text>
        </View>
      </SafeAreaView>
    );
  }

  const allPlayers = [...match.lineup, ...match.reserve_players];
  const formationPositions = getFormationPositions();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={20} color="#374151" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.matchTitle}>
            {match.home_team} vs {match.away_team}
          </Text>
          <Text style={styles.teamName}>{match.teams.name}</Text>
        </View>
      </View>

      <View style={styles.scoreBoard}>
        <View style={styles.scoreContainer}>
          <Text style={styles.teamScore}>{match.home_team}</Text>
          <Text style={styles.score}>{match.home_score}</Text>
        </View>
        <Text style={styles.scoreSeparator}>-</Text>
        <View style={styles.scoreContainer}>
          <Text style={styles.score}>{match.away_score}</Text>
          <Text style={styles.teamScore}>{match.away_team}</Text>
        </View>
      </View>

      <LiveMatchTimer
        matchTime={match.match_time}
        currentQuarter={match.current_quarter}
        quarterTimes={match.quarter_times}
        status={match.status}
        onStart={startMatch}
        onPause={pauseMatch}
        onResume={resumeMatch}
        onEnd={endMatch}
        onNextQuarter={nextQuarter}
        onTimeUpdate={handleTimeUpdate}
      />

      {isSubstituting && (
        <View style={styles.substitutionBanner}>
          <ArrowUpDown size={14} color="#16A34A" />
          <Text style={styles.substitutionText}>
            {selectedPosition 
              ? `Selecteer een speler voor positie ${getPositionName(selectedPosition)}`
              : 'Selecteer een positie of speler om te wisselen'
            }
          </Text>
          <TouchableOpacity onPress={cancelSubstitution}>
            <Text style={styles.cancelText}>Annuleren</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'positions' && styles.activeTab]}
          onPress={() => setActiveTab('positions')}
        >
          <Grid3X3 size={16} color={activeTab === 'positions' ? '#10B981' : '#6B7280'} />
          <Text style={[styles.tabText, activeTab === 'positions' && styles.activeTabText]}>
            Posities
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'lineup' && styles.activeTab]}
          onPress={() => setActiveTab('lineup')}
        >
          <Users size={16} color={activeTab === 'lineup' ? '#10B981' : '#6B7280'} />
          <Text style={[styles.tabText, activeTab === 'lineup' && styles.activeTabText]}>
            Opstelling
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'events' && styles.activeTab]}
          onPress={() => setActiveTab('events')}
        >
          <Activity size={16} color={activeTab === 'events' ? '#10B981' : '#6B7280'} />
          <Text style={[styles.tabText, activeTab === 'events' && styles.activeTabText]}>
            Gebeurtenissen
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'stats' && styles.activeTab]}
          onPress={() => setActiveTab('stats')}
        >
          <BarChart3 size={16} color={activeTab === 'stats' ? '#10B981' : '#6B7280'} />
          <Text style={[styles.tabText, activeTab === 'stats' && styles.activeTabText]}>
            Statistieken
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'positions' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Grid3X3 size={18} color="#16A34A" />
              <Text style={styles.sectionTitle}>Formatie Posities</Text>
            </View>
            
            {formationPositions.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Grid3X3 size={40} color="#9CA3AF" />
                <Text style={styles.emptyTitle}>Geen formatie ingesteld</Text>
                <Text style={styles.emptySubtitle}>
                  Er is geen formatie geselecteerd voor deze wedstrijd
                </Text>
              </View>
            ) : (
              <View style={styles.positionsList}>
                {formationPositions.map((position) => {
                  const player = getPlayerInPosition(position.id);
                  return (
                    <PositionCard
                      key={position.id}
                      position={position}
                      player={player}
                      stats={player ? getPlayerStats(player.id) : undefined}
                      isSelected={selectedPosition === position.id}
                      isSubstituting={isSubstituting}
                      onPress={() => handlePositionPress(position)}
                    />
                  );
                })}
              </View>
            )}

            {/* Reserve Players for Position Substitutions */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Users size={18} color="#6B7280" />
                <Text style={styles.sectionTitle}>Bank ({match.reserve_players.length})</Text>
              </View>
              {match.reserve_players.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Users size={28} color="#9CA3AF" />
                  <Text style={styles.emptyText}>Geen reservespelers</Text>
                </View>
              ) : (
                <View style={styles.playersList}>
                  {match.reserve_players.map((player) => (
                    <LivePlayerCard
                      key={player.id}
                      player={player}
                      stats={getPlayerStats(player.id)}
                      isOnField={false}
                      isSelected={false}
                      isSubstituting={isSubstituting}
                      onPress={() => handlePlayerPress(player, false)}
                    />
                  ))}
                </View>
              )}
            </View>
          </View>
        )}

        {activeTab === 'lineup' && (
          <>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Star size={18} color="#16A34A" />
                <Text style={styles.sectionTitle}>Basisopstelling ({match.lineup.length})</Text>
              </View>
              {match.lineup.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Users size={40} color="#9CA3AF" />
                  <Text style={styles.emptyTitle}>Geen basisopstelling ingesteld</Text>
                </View>
              ) : (
                <View style={styles.playersList}>
                  {match.lineup.map((player) => (
                    <LivePlayerCard
                      key={player.id}
                      player={player}
                      stats={getPlayerStats(player.id)}
                      isOnField={true}
                      isSelected={false}
                      isSubstituting={isSubstituting}
                      onPress={() => handlePlayerPress(player, true)}
                    />
                  ))}
                </View>
              )}
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Users size={18} color="#6B7280" />
                <Text style={styles.sectionTitle}>Bank ({match.reserve_players.length})</Text>
              </View>
              {match.reserve_players.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Users size={28} color="#9CA3AF" />
                  <Text style={styles.emptyText}>Geen reservespelers</Text>
                </View>
              ) : (
                <View style={styles.playersList}>
                  {match.reserve_players.map((player) => (
                    <LivePlayerCard
                      key={player.id}
                      player={player}
                      stats={getPlayerStats(player.id)}
                      isOnField={false}
                      isSelected={false}
                      isSubstituting={isSubstituting}
                      onPress={() => handlePlayerPress(player, false)}
                    />
                  ))}
                </View>
              )}
            </View>
          </>
        )}

        {activeTab === 'events' && (
          <>
            {(match.status === 'inProgress' || match.status === 'paused') && (
              <MatchEventLogger
                players={allPlayers}
                onAddEvent={addMatchEvent}
                currentTime={match.match_time}
                currentQuarter={match.current_quarter}
              />
            )}

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Activity size={18} color="#EA580C" />
                <Text style={styles.sectionTitle}>Wedstrijd Gebeurtenissen ({matchEvents.length})</Text>
              </View>
              
              {matchEvents.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Activity size={40} color="#9CA3AF" />
                  <Text style={styles.emptyTitle}>Nog geen gebeurtenissen</Text>
                </View>
              ) : (
                <View style={styles.eventsList}>
                  {matchEvents.slice().reverse().map((event) => (
                    <View key={event.id} style={styles.eventCard}>
                      <View style={styles.eventHeader}>
                        <View style={styles.eventTime}>
                          <Text style={styles.eventTimeText}>
                            {formatTime(event.time)} - K{event.quarter}
                          </Text>
                        </View>
                        <View style={styles.eventIcon}>
                          {event.type === 'goal' && <Target size={14} color="#10B981" />}
                          {event.type === 'card' && <AlertTriangle size={14} color="#F59E0B" />}
                          {event.type === 'substitution' && <ArrowUpDown size={14} color="#6B7280" />}
                          {(event.type === 'quarter_start' || event.type === 'quarter_end' || 
                            event.type === 'match_start' || event.type === 'match_end') && 
                            <Activity size={14} color="#6B7280" />}
                        </View>
                      </View>
                      
                      <View style={styles.eventContent}>
                        <Text style={styles.eventType}>
                          {event.type === 'goal' && 'Goal'}
                          {event.type === 'card' && 'Kaart'}
                          {event.type === 'substitution' && 'Wissel'}
                          {event.type === 'quarter_start' && 'Kwart Start'}
                          {event.type === 'quarter_end' && 'Kwart Einde'}
                          {event.type === 'match_start' && 'Wedstrijd Start'}
                          {event.type === 'match_end' && 'Wedstrijd Einde'}
                        </Text>
                        
                        {event.player && (
                          <Text style={styles.eventPlayer}>
                            #{event.player.number || '?'} {event.player.name}
                          </Text>
                        )}
                        
                        {event.details && (
                          <Text style={styles.eventDetails}>{event.details}</Text>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>
        )}

        {activeTab === 'stats' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <BarChart3 size={18} color="#8B5CF6" />
              <Text style={styles.sectionTitle}>Speler Statistieken</Text>
            </View>
            
            <View style={styles.statsList}>
              {playerStats
                .filter(stat => stat.timeOnField > 0 || stat.quartersPlayed.length > 0)
                .sort((a, b) => b.timeOnField - a.timeOnField)
                .map((stat) => {
                  const player = allPlayers.find(p => p.id === stat.playerId);
                  if (!player) return null;
                  
                  return (
                    <View key={stat.playerId} style={styles.statCard}>
                      <View style={styles.statHeader}>
                        <Text style={styles.statPlayerName}>
                          #{player.number || '?'} {player.name}
                        </Text>
                        <Text style={styles.statTime}>
                          {formatTime(stat.timeOnField)}
                        </Text>
                      </View>
                      
                      <View style={styles.statDetails}>
                        <Text style={styles.statDetail}>
                          Kwarten: {stat.quartersPlayed.join(', ') || 'Geen'}
                        </Text>
                        <Text style={styles.statDetail}>
                          Wissels: {stat.substitutions}
                        </Text>
                        {(stat.goals || 0) > 0 && (
                          <Text style={[styles.statDetail, { color: '#10B981' }]}>
                            Goals: {stat.goals}
                          </Text>
                        )}
                        {(stat.cards || 0) > 0 && (
                          <Text style={[styles.statDetail, { color: '#F59E0B' }]}>
                            Kaarten: {stat.cards}
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                })}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  matchTitle: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  teamName: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Inter-Regular',
  },
  scoreBoard: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 20,
  },
  scoreContainer: {
    alignItems: 'center',
  },
  teamScore: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
    marginBottom: 4,
  },
  score: {
    fontSize: 32,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  scoreSeparator: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#9CA3AF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    fontFamily: 'Inter-Medium',
  },
  substitutionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 6,
  },
  substitutionText: {
    flex: 1,
    fontSize: 12,
    color: '#16A34A',
    fontFamily: 'Inter-Medium',
  },
  cancelText: {
    fontSize: 12,
    color: '#DC2626',
    fontFamily: 'Inter-SemiBold',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#10B981',
  },
  tabText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
  },
  activeTabText: {
    color: '#10B981',
  },
  content: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
    marginTop: 12,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 24,
    fontFamily: 'Inter-Regular',
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 6,
    fontFamily: 'Inter-Medium',
  },
  positionsList: {
    gap: 8,
  },
  playersList: {
    gap: 6,
  },
  eventsList: {
    gap: 8,
  },
  eventCard: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  eventTime: {},
  eventTimeText: {
    fontSize: 10,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
  },
  eventIcon: {},
  eventContent: {},
  eventType: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
    marginBottom: 2,
  },
  eventPlayer: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    marginBottom: 2,
  },
  eventDetails: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
  },
  statsList: {
    gap: 8,
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  statPlayerName: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
  },
  statTime: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: '#10B981',
  },
  statDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statDetail: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
});