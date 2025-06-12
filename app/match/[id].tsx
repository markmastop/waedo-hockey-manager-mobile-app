import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  Image,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Player, Substitution, MatchEvent, PlayerStats, FormationPosition } from '@/types/database';
import { Match } from '@/types/match';
import { LiveMatchTimer } from '@/components/LiveMatchTimer';
import FieldView from '@/components/FieldView';
import { convertPlayersDataToArray } from '@/lib/playerUtils';
import { 
  ArrowLeft, 
  Users, 
  ArrowUpDown, 
  Star, 
  Grid3x3 as Grid3X3, 
  User, 
  Target, 
  Clock,
  Trophy,
  MapPin,
  Calendar,
  Zap,
  Shield,
  Activity
} from 'lucide-react-native';
import { getPositionColor, getPositionDisplayName } from '@/lib/playerPositions';

interface Formation {
  id: string;
  key: string;
  name_translations: Record<string, string>;
  positions: FormationPosition[];
}

interface CompactPlayerCardProps {
  player: Player;
  stats?: PlayerStats;
  isOnField: boolean;
  isSelected?: boolean;
  isSubstituting?: boolean;
  onPress?: () => void;
}

function CompactPlayerCard({
  player,
  stats,
  isOnField,
  isSelected,
  isSubstituting,
  onPress,
}: CompactPlayerCardProps) {
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getCardStyle = () => {
    if (isSelected) return styles.selectedPlayerCard;
    if (isSubstituting) return styles.substitutingPlayerCard;
    if (isOnField) return styles.onFieldPlayerCard;
    return styles.benchPlayerCard;
  };

  return (
    <TouchableOpacity
      style={[styles.compactPlayerCard, getCardStyle()]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.playerCardContent}>
        <View style={styles.playerMainInfo}>
          <View style={[
            styles.playerNumberBadge,
            { backgroundColor: getPositionColor(player.position) }
          ]}>
            <Text style={styles.playerNumberText}>{player.number || '?'}</Text>
          </View>
          
          <View style={styles.playerDetails}>
            <Text style={styles.playerName} numberOfLines={1}>{player.name}</Text>
            <View style={styles.playerMeta}>
              <Text style={[
                styles.positionText,
                { color: getPositionColor(player.position) }
              ]}>
                {getPositionDisplayName(player.position)}
              </Text>
              {stats && stats.timeOnField > 0 && (
                <>
                  <View style={styles.metaDivider} />
                  <Clock size={10} color="#6B7280" />
                  <Text style={styles.timeText}>{formatTime(stats.timeOnField)}</Text>
                </>
              )}
            </View>
          </View>
        </View>

        <View style={styles.playerStatus}>
          {isOnField && (
            <View style={styles.onFieldIndicator}>
              <Star size={10} color="#10B981" fill="#10B981" />
            </View>
          )}
          
          {stats && stats.goals && stats.goals > 0 && (
            <View style={styles.goalBadge}>
              <Target size={8} color="#FFFFFF" />
              <Text style={styles.goalText}>{stats.goals}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
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
  const [viewMode, setViewMode] = useState<'formation' | 'list'>('list');

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

  const fetchFormation = async (formationIdentifier: string) => {
    if (!formationIdentifier) return;
    
    try {
      let query = supabase.from('formations').select('*');
      
      if (isValidUUID(formationIdentifier)) {
        query = query.eq('id', formationIdentifier);
      } else {
        query = query.eq('key', formationIdentifier);
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
      
      const formationIdentifier = data.formation_key || data.formation;
      if (formationIdentifier) {
        await fetchFormation(formationIdentifier);
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

  const getFormationDisplayName = (): string => {
    if (!formation) return '';
    
    const nameTranslations = formation.name_translations || {};
    return nameTranslations.nl || nameTranslations.en || formation.key || '';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('nl-NL', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'inProgress':
      case 'paused':
        return '#10B981';
      case 'upcoming':
        return '#F59E0B';
      case 'completed':
        return '#6B7280';
      default:
        return '#6B7280';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'inProgress':
        return 'LIVE';
      case 'paused':
        return 'GEPAUZEERD';
      case 'upcoming':
        return 'AANKOMEND';
      case 'completed':
        return 'AFGEROND';
      default:
        return status.toUpperCase();
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Activity size={32} color="#FF6B35" />
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
      {/* Enhanced Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={20} color="#FFFFFF" />
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
          <View style={styles.matchInfo}>
            <Text style={styles.matchTitle}>
              {match.home_team} vs {match.away_team}
            </Text>
            <View style={styles.matchMeta}>
              <MapPin size={12} color="rgba(255, 255, 255, 0.8)" />
              <Text style={styles.matchLocation}>{match.location}</Text>
              <View style={styles.metaDivider} />
              <Calendar size={12} color="rgba(255, 255, 255, 0.8)" />
              <Text style={styles.matchDate}>{formatDate(match.date)}</Text>
            </View>
          </View>
          
          <View style={styles.statusBadge}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: getStatusColor(match.status) },
              ]}
            />
            <Text style={styles.statusText}>
              {getStatusText(match.status)}
            </Text>
          </View>
        </View>
      </View>

      {/* Enhanced Score Board */}
      <View style={styles.scoreBoard}>
        <View style={styles.scoreSection}>
          <View style={styles.teamContainer}>
            <View style={styles.teamInfo}>
              <Text style={styles.teamName}>{match.home_team}</Text>
              <Text style={styles.teamLabel}>Thuis</Text>
            </View>
            <View style={styles.scoreContainer}>
              <Text style={styles.score}>{match.home_score}</Text>
            </View>
          </View>
          
          <View style={styles.scoreDivider}>
            <Text style={styles.scoreSeparator}>-</Text>
            <Text style={styles.teamNameSmall}>{match.teams.name}</Text>
          </View>
          
          <View style={styles.teamContainer}>
            <View style={styles.scoreContainer}>
              <Text style={styles.score}>{match.away_score}</Text>
            </View>
            <View style={styles.teamInfo}>
              <Text style={styles.teamName}>{match.away_team}</Text>
              <Text style={styles.teamLabel}>Uit</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Match Timer */}
      <View style={styles.timerSection}>
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
      </View>

      {/* Substitution Banner */}
      {isSubstituting && (
        <View style={styles.substitutionBanner}>
          <View style={styles.substitutionContent}>
            <Zap size={16} color="#16A34A" />
            <Text style={styles.substitutionText}>
              {selectedPosition 
                ? `Selecteer een speler voor positie ${getPositionName(selectedPosition)}`
                : 'Selecteer een positie of speler om te wisselen'
              }
            </Text>
          </View>
          <TouchableOpacity onPress={cancelSubstitution} style={styles.cancelButton}>
            <Text style={styles.cancelText}>Annuleren</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Enhanced View Mode Toggle */}
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
            Opstelling
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {viewMode === 'formation' ? (
          /* Enhanced Formation View */
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleContainer}>
                <Grid3X3 size={20} color="#16A34A" />
                <Text style={styles.sectionTitle}>
                  Formatie {formation ? `(${getFormationDisplayName()})` : ''}
                </Text>
              </View>
            </View>
            
            {!formation || formation.positions.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Grid3X3 size={48} color="#9CA3AF" />
                <Text style={styles.emptyTitle}>Geen formatie ingesteld</Text>
                <Text style={styles.emptySubtitle}>
                  Er is geen formatie geselecteerd voor deze wedstrijd
                </Text>
              </View>
            ) : (
              <FieldView
                positions={formation.positions}
                lineup={match.lineup}
                highlightPosition={selectedPosition}
                onPositionPress={handlePositionPress}
              />
            )}

            {/* Enhanced Reserve Players */}
            <View style={styles.reserveSection}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleContainer}>
                  <Users size={20} color="#6B7280" />
                  <Text style={styles.sectionTitle}>Bank</Text>
                  <View style={styles.countBadge}>
                    <Text style={styles.countText}>{match.reserve_players.length}</Text>
                  </View>
                </View>
              </View>
              
              {match.reserve_players.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Users size={32} color="#9CA3AF" />
                  <Text style={styles.emptyText}>Geen reservespelers</Text>
                </View>
              ) : (
                <View style={styles.compactPlayersList}>
                  {match.reserve_players.map((player) => (
                    <CompactPlayerCard
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
          /* Enhanced Two-Column List View */
          <View style={styles.twoColumnContainer}>
            {/* Left Column - Lineup */}
            <View style={styles.column}>
              <View style={styles.columnHeader}>
                <View style={styles.columnTitleContainer}>
                  <Star size={16} color="#16A34A" />
                  <Text style={styles.columnTitle}>Basisopstelling</Text>
                </View>
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{match.lineup.length}</Text>
                </View>
              </View>
              
              {match.lineup.length === 0 ? (
                <View style={styles.emptyColumnContainer}>
                  <User size={28} color="#9CA3AF" />
                  <Text style={styles.emptyColumnText}>Geen opstelling</Text>
                </View>
              ) : (
                <View style={styles.compactPlayersList}>
                  {match.lineup.map((player) => (
                    <CompactPlayerCard
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

            {/* Right Column - Reserves */}
            <View style={styles.column}>
              <View style={styles.columnHeader}>
                <View style={styles.columnTitleContainer}>
                  <Users size={16} color="#6B7280" />
                  <Text style={styles.columnTitle}>Bank</Text>
                </View>
                <View style={[styles.countBadge, styles.reserveCountBadge]}>
                  <Text style={[styles.countText, styles.reserveCountText]}>{match.reserve_players.length}</Text>
                </View>
              </View>
              
              {match.reserve_players.length === 0 ? (
                <View style={styles.emptyColumnContainer}>
                  <Users size={28} color="#9CA3AF" />
                  <Text style={styles.emptyColumnText}>Geen reserves</Text>
                </View>
              ) : (
                <View style={styles.compactPlayersList}>
                  {match.reserve_players.map((player) => (
                    <CompactPlayerCard
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: 'linear-gradient(135deg, #FF6B35 0%, #F56500 100%)',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  matchInfo: {
    flex: 1,
  },
  matchTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  matchMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  matchLocation: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    fontFamily: 'Inter-Medium',
  },
  matchDate: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    fontFamily: 'Inter-Medium',
  },
  metaDivider: {
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  scoreBoard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: -12,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  scoreSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  teamContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  teamInfo: {
    alignItems: 'center',
    flex: 1,
  },
  teamName: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 2,
  },
  teamLabel: {
    fontSize: 10,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  scoreContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 12,
  },
  score: {
    fontSize: 28,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  scoreDivider: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  scoreSeparator: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#9CA3AF',
    marginBottom: 4,
  },
  teamNameSmall: {
    fontSize: 10,
    fontFamily: 'Inter-SemiBold',
    color: '#FF6B35',
    textAlign: 'center',
  },
  timerSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
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
    marginHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginBottom: 16,
  },
  substitutionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  substitutionText: {
    flex: 1,
    fontSize: 13,
    color: '#16A34A',
    fontFamily: 'Inter-Medium',
  },
  cancelButton: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  cancelText: {
    fontSize: 12,
    color: '#DC2626',
    fontFamily: 'Inter-SemiBold',
  },
  viewModeContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  viewModeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  activeViewMode: {
    backgroundColor: '#FF6B35',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  viewModeText: {
    fontSize: 14,
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
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    marginTop: 24,
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    flex: 1,
  },
  countBadge: {
    backgroundColor: '#16A34A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 28,
    alignItems: 'center',
  },
  countText: {
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 32,
    fontFamily: 'Inter-Regular',
    lineHeight: 20,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 12,
    fontFamily: 'Inter-Medium',
  },
  // Two-column layout styles
  twoColumnContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 16,
  },
  column: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    overflow: 'hidden',
  },
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  columnTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  columnTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  reserveCountBadge: {
    backgroundColor: '#6B7280',
  },
  reserveCountText: {
    color: '#FFFFFF',
  },
  emptyColumnContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 16,
  },
  emptyColumnText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 8,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
  },
  // Compact player card styles
  compactPlayersList: {
    padding: 12,
    gap: 8,
  },
  compactPlayerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  selectedPlayerCard: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
    shadowColor: '#10B981',
    shadowOpacity: 0.2,
  },
  substitutingPlayerCard: {
    borderColor: '#FF6B35',
    backgroundColor: '#FEF2F2',
    shadowColor: '#FF6B35',
    shadowOpacity: 0.2,
  },
  onFieldPlayerCard: {
    borderColor: '#10B981',
    backgroundColor: '#FFFFFF',
  },
  benchPlayerCard: {
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  playerCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  playerMainInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  playerNumberBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  playerNumberText: {
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  playerDetails: {
    flex: 1,
    minWidth: 0,
  },
  playerName: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 4,
  },
  playerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  positionText: {
    fontSize: 10,
    fontFamily: 'Inter-Medium',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeText: {
    fontSize: 10,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  playerStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  onFieldIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  goalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 2,
  },
  goalText: {
    fontSize: 10,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
});