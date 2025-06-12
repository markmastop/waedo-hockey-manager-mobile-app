import React, { useState, useEffect } from 'react';
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
import { PositionCard } from '../../components/PositionCard';
import { convertPlayersDataToArray } from '@/lib/playerUtils';
import { ArrowLeft, Users, ArrowUpDown, Star, Grid3x3 as Grid3X3, Play, Pause, Square } from 'lucide-react-native';

interface Formation {
  id: string;
  name: string;
  positions: FormationPosition[];
}

export default function MatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [match, setMatch] = useState<Match | null>(null);
  const [formation, setFormation] = useState<Formation | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null);
  const [isSubstituting, setIsSubstituting] = useState(false);
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>([]);
  const [matchEvents, setMatchEvents] = useState<MatchEvent[]>([]);
  const [viewMode, setViewMode] = useState<'formation' | 'list'>('formation');

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

  const isValidUUID = (str: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  };

  const fetchFormation = async (formationKey: string) => {
    if (!formationKey) return;
    
    try {
      let query = supabase.from('formations').select('*');
      
      if (isValidUUID(formationKey)) {
        query = query.eq('id', formationKey);
      } else {
        query = query.eq('key', formationKey);
      }
      
      const { data, error } = await query.single();

      if (error) {
        console.error('Error fetching formation:', error);
        return;
      }
      
      if (data) {
        const sortedPositions = Array.isArray(data.positions) 
          ? data.positions.sort((a: FormationPosition, b: FormationPosition) => a.order - b.order)
          : [];
          
        setFormation({
          ...data,
          positions: sortedPositions
        });
      }
    } catch (error) {
      console.error('Error fetching formation:', error);
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
        formation: data.formation_key || data.formation || '',
        substitution_schedule: data.substitution_schedule || {},
      };
      
      setMatch(matchData);
      setPlayerStats(statsArray);
      setMatchEvents(eventsArray);
      
      const formationKey = data.formation_key || data.formation;
      if (formationKey) {
        await fetchFormation(formationKey);
      }
    } catch (error) {
      console.error('Error fetching match:', error);
      Alert.alert('Fout', 'Kon wedstrijdgegevens niet laden');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchMatch();
    }
  }, [id]);

  const updateMatch = async (updates: Partial<Match>) => {
    if (!match) return;

    try {
      const dbUpdates: Partial<Match> = {};
      Object.keys(updates).forEach(key => {
        dbUpdates[key as keyof Match] = updates[key as keyof Match];
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
    updateMatch({ status: 'inProgress' });
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
          onPress: () => updateMatch({ status: 'completed' }),
        },
      ]
    );
  };

  const handleTimeUpdate = (newTime: number) => {
    if (match) {
      updateMatch({ match_time: newTime });
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

    const currentPlayer = getPlayerInPosition(selectedPosition);
    const targetPlayer = getPlayerInPosition(targetPosition.id);

    if (currentPlayer && targetPlayer) {
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
      const playerIndex = newLineup.findIndex(p => p.id === player.id);
      const currentIndex = newLineup.findIndex(p => p.id === currentPositionPlayer.id);
      
      if (playerIndex !== -1 && currentIndex !== -1) {
        const tempPosition = newLineup[playerIndex].position;
        newLineup[playerIndex] = { ...newLineup[playerIndex], position: newLineup[currentIndex].position };
        newLineup[currentIndex] = { ...newLineup[currentIndex], position: tempPosition };
      }
    } else if (!isOnField && currentPositionPlayer) {
      const reserveIndex = newReservePlayers.findIndex(p => p.id === player.id);
      const fieldIndex = newLineup.findIndex(p => p.id === currentPositionPlayer.id);
      
      if (reserveIndex !== -1 && fieldIndex !== -1) {
        const positionName = getPositionName(selectedPosition);
        newLineup[fieldIndex] = { ...player, position: positionName };
        newReservePlayers[reserveIndex] = currentPositionPlayer;

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
    if (!match || !formation) return null;
    const position = formation.positions.find(p => p.id === positionId);
    if (!position) return null;
    return match.lineup.find(player => player.position === position.dutch_name) || null;
  };

  const getPositionName = (positionId: string): string => {
    if (!formation) return '';
    const position = formation.positions.find(p => p.id === positionId);
    return position?.dutch_name || '';
  };

  const cancelSubstitution = () => {
    setSelectedPosition(null);
    setIsSubstituting(false);
  };

  const getPlayerStats = (playerId: string): PlayerStats | undefined => {
    return playerStats.find(stat => stat.playerId === playerId);
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

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
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

      {/* Score Board */}
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

      {/* Match Timer */}
      <LiveMatchTimer
        matchTime={match.match_time}
        currentQuarter={match.current_quarter}
        quarterTimes={match.quarter_times}
        status={match.status}
        onStart={startMatch}
        onPause={pauseMatch}
        onResume={resumeMatch}
        onEnd={endMatch}
        onNextQuarter={() => {}}
        onTimeUpdate={handleTimeUpdate}
      />

      {/* Substitution Banner */}
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

      {/* View Mode Toggle */}
      <View style={styles.viewModeContainer}>
        <TouchableOpacity
          style={[styles.viewModeButton, viewMode === 'formation' && styles.activeViewMode]}
          onPress={() => setViewMode('formation')}
        >
          <Grid3X3 size={16} color={viewMode === 'formation' ? '#FFFFFF' : '#6B7280'} />
          <Text style={[styles.viewModeText, viewMode === 'formation' && styles.activeViewModeText]}>
            Formatie
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.viewModeButton, viewMode === 'list' && styles.activeViewMode]}
          onPress={() => setViewMode('list')}
        >
          <Users size={16} color={viewMode === 'list' ? '#FFFFFF' : '#6B7280'} />
          <Text style={[styles.viewModeText, viewMode === 'list' && styles.activeViewModeText]}>
            Lijst
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {viewMode === 'formation' ? (
          /* Formation View */
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Grid3X3 size={18} color="#16A34A" />
              <Text style={styles.sectionTitle}>
                Formatie {formation ? `(${formation.name})` : ''}
              </Text>
            </View>
            
            {!formation || formation.positions.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Grid3X3 size={40} color="#9CA3AF" />
                <Text style={styles.emptyTitle}>Geen formatie ingesteld</Text>
                <Text style={styles.emptySubtitle}>
                  Er is geen formatie geselecteerd voor deze wedstrijd
                </Text>
              </View>
            ) : (
              <View style={styles.positionsList}>
                {formation.positions.map((position) => {
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

            {/* Reserve Players */}
            <View style={styles.reserveSection}>
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
        ) : (
          /* List View */
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
    fontSize: 18,
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
    paddingVertical: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 24,
  },
  scoreContainer: {
    alignItems: 'center',
  },
  teamScore: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
    marginBottom: 6,
  },
  score: {
    fontSize: 36,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  scoreSeparator: {
    fontSize: 28,
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
    paddingVertical: 12,
    gap: 8,
  },
  substitutionText: {
    flex: 1,
    fontSize: 13,
    color: '#16A34A',
    fontFamily: 'Inter-Medium',
  },
  cancelText: {
    fontSize: 13,
    color: '#DC2626',
    fontFamily: 'Inter-SemiBold',
  },
  viewModeContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginVertical: 16,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  viewModeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  activeViewMode: {
    backgroundColor: '#16A34A',
  },
  viewModeText: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
  },
  activeViewModeText: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  reserveSection: {
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    marginTop: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
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
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 24,
    fontFamily: 'Inter-Regular',
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
    fontFamily: 'Inter-Medium',
  },
  positionsList: {
    gap: 10,
  },
  playersList: {
    gap: 8,
  },
});