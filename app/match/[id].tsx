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
import { LiveMatchTimer } from '@/components/LiveMatchTimer';
import FieldView from '@/components/FieldView';
import { convertPlayersDataToArray } from '@/lib/playerUtils';
import { ArrowLeft, Users, ArrowUpDown, Star, Grid3x3 as Grid3X3, User, Target, Clock, Calendar } from 'lucide-react-native';
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
  formation?: Formation | null;
}

function CompactPlayerCard({
  player,
  stats,
  isOnField,
  isSelected,
  isSubstituting,
  onPress,
  formation,
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

  // Get the Dutch position name for this player
  const getDutchPositionForPlayer = (player: Player): string => {
    if (!formation) {
      return getPositionDisplayName(player.position);
    }

    // Find the formation position that matches this player's position
    const formationPosition = formation.positions.find(pos => {
      const dutchName = pos.label_translations?.nl || pos.dutch_name || pos.name;
      return player.position === dutchName || 
             player.position === pos.dutch_name || 
             player.position === pos.name;
    });

    if (formationPosition) {
      return formationPosition.label_translations?.nl || formationPosition.dutch_name || formationPosition.name || player.position;
    }

    // Fallback to the utility function
    return getPositionDisplayName(player.position);
  };

  const displayPosition = getDutchPositionForPlayer(player);

  return (
    <TouchableOpacity
      style={[styles.compactPlayerCard, getCardStyle()]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.playerRow}>
        <View style={[
          styles.playerNumberBadge,
          { backgroundColor: getPositionColor(player.position) }
        ]}>
          <Text style={styles.playerNumberText}>#{player.number || '?'}</Text>
        </View>
        
        <View style={styles.playerInfo}>
          <Text style={styles.playerName} numberOfLines={1}>{player.name}</Text>
          <View style={styles.playerMeta}>
            <Text style={[
              styles.positionText,
              { color: getPositionColor(player.position) }
            ]}>
              {displayPosition}
            </Text>
            {stats && stats.timeOnField > 0 && (
              <>
                <Text style={styles.metaSeparator}>•</Text>
                <Text style={styles.timeText}>{formatTime(stats.timeOnField)}</Text>
              </>
            )}
            {stats && stats.goals && stats.goals > 0 && (
              <>
                <Text style={styles.metaSeparator}>•</Text>
                <View style={styles.statBadge}>
                  <Target size={8} color="#10B981" />
                  <Text style={styles.statText}>{stats.goals}</Text>
                </View>
              </>
            )}
          </View>
        </View>

        {isOnField && (
          <Star size={12} color="#10B981" fill="#10B981" />
        )}
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

  // Helper function to convert positions object to array
  const convertPositionsToArray = (positions: any): FormationPosition[] => {
    console.log('🔄 Converting positions to array:', positions);
    
    if (Array.isArray(positions)) {
      console.log('✅ Positions already an array');
      return positions;
    }
    
    if (positions && typeof positions === 'object') {
      console.log('🔧 Converting object to array...');
      const positionsArray: FormationPosition[] = [];
      
      Object.entries(positions).forEach(([key, value]: [string, any], index) => {
        if (value && typeof value === 'object') {
          const position: FormationPosition = {
            id: value.id || key,
            name: value.name || key,
            dutch_name: value.dutch_name || value.name || key,
            label_translations: value.label_translations || {},
            order: value.order || index + 1,
            x: value.x || 50,
            y: value.y || 50,
          };
          positionsArray.push(position);
          console.log(`📍 Added position: ${position.name} (Dutch: ${position.label_translations?.nl || position.dutch_name}) (${position.x}, ${position.y})`);
        }
      });
      
      // Sort by order
      positionsArray.sort((a, b) => a.order - b.order);
      console.log(`✅ Converted ${positionsArray.length} positions`);
      return positionsArray;
    }
    
    console.log('⚠️ No valid positions data found');
    return [];
  };

  const fetchFormation = async (formationIdentifier: string) => {
    console.log('🔍 fetchFormation called with:', formationIdentifier);
    
    if (!formationIdentifier) {
      console.log('❌ No formationIdentifier provided');
      return;
    }
    
    try {
      let query = supabase.from('formations').select('*');
      
      if (isValidUUID(formationIdentifier)) {
        console.log('📋 Using UUID query for formation ID:', formationIdentifier);
        query = query.eq('id', formationIdentifier);
      } else {
        console.log('🔑 Using key query for formation key:', formationIdentifier);
        query = query.eq('key', formationIdentifier);
      }
      
      console.log('🚀 Executing Supabase query...');
      const { data, error } = await query.single();

      if (error) {
        console.error('❌ Error fetching formation:', error);
        console.error('Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        return;
      }
      
      console.log('✅ Formation data received:', data);
      
      if (data) {
        console.log('📊 Processing formation data...');
        console.log('- Formation ID:', data.id);
        console.log('- Formation key:', data.key);
        console.log('- Name translations:', data.name_translations);
        console.log('- Raw positions:', data.positions);
        console.log('- Positions is array:', Array.isArray(data.positions));
        console.log('- Positions length:', data.positions?.length || 0);
        
        // Convert positions to array format
        const positionsArray = convertPositionsToArray(data.positions);
        console.log('📋 Final positions array:', positionsArray);
        
        const formationObject = {
          ...data,
          positions: positionsArray
        };
        
        console.log('🎯 Final formation object:', formationObject);
        setFormation(formationObject);
        console.log('✅ Formation state updated');
      } else {
        console.log('⚠️ No formation data returned from query');
      }
    } catch (error) {
      console.error('💥 Exception in fetchFormation:', error);
    }
  };

  const fetchMatch = async () => {
    console.log('🏒 fetchMatch called for match ID:', id);
    
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
      
      console.log('📊 Match data received:', data);
      console.log('- Formation key:', data.formation_key);
      console.log('- Formation (legacy):', data.formation);
      
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
      
      console.log('🎯 Processed match data:', matchData);
      setMatch(matchData);
      setPlayerStats(statsArray);
      setMatchEvents(eventsArray);
      
      const formationIdentifier = data.formation_key || data.formation;
      console.log('🔍 Formation identifier to fetch:', formationIdentifier);
      
      if (formationIdentifier) {
        console.log('📋 Calling fetchFormation with:', formationIdentifier);
        await fetchFormation(formationIdentifier);
      } else {
        console.log('⚠️ No formation identifier found in match data');
      }
    } catch (error) {
      console.error('💥 Error fetching match:', error);
      Alert.alert('Fout', 'Kon wedstrijdgegevens niet laden');
    } finally {
      setLoading(false);
      console.log('✅ fetchMatch completed, loading set to false');
    }
  };

  useEffect(() => {
    console.log('🔄 useEffect triggered with match ID:', id);
    if (id) {
      fetchMatch();
    }
  }, [id]);

  // Add debug logging for formation state changes
  useEffect(() => {
    console.log('🎯 Formation state changed:', formation);
    if (formation) {
      console.log('- Formation has positions:', formation.positions?.length || 0);
      console.log('- Formation positions array:', formation.positions);
    }
  }, [formation]);

  // Add debug logging for viewMode changes
  useEffect(() => {
    console.log('👁️ View mode changed to:', viewMode);
  }, [viewMode]);

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

  const getDutchPositionName = (pos: FormationPosition): string => {
    // First try to get from label_translations.nl
    if (pos.label_translations && pos.label_translations.nl) {
      return pos.label_translations.nl;
    }
    
    // Fallback to dutch_name, then name
    return pos.dutch_name || pos.name || 'Onbekend';
  };

  const makePositionSubstitution = (targetPosition: FormationPosition) => {
    if (!match || !selectedPosition) return;

    const currentPlayer = getPlayerInPosition(selectedPosition);
    const targetPlayer = getPlayerInPosition(targetPosition.id);

    if (currentPlayer && targetPlayer) {
      const newLineup = match.lineup.map(player => {
        if (player.id === currentPlayer.id) {
          return { ...player, position: getDutchPositionName(targetPosition) };
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
    
    const dutchName = getDutchPositionName(position);
    
    // Try multiple matching strategies to find the player
    let foundPlayer = match.lineup.find(player => player.position === dutchName);
    
    if (!foundPlayer) {
      // Fallback: try dutch_name
      foundPlayer = match.lineup.find(player => player.position === position.dutch_name);
    }
    
    if (!foundPlayer) {
      // Fallback: try name
      foundPlayer = match.lineup.find(player => player.position === position.name);
    }
    
    console.log(`🔍 Looking for player in position ${positionId} (${dutchName}): ${foundPlayer?.name || 'not found'}`);
    return foundPlayer || null;
  };

  const getPositionName = (positionId: string): string => {
    if (!formation) return '';
    const position = formation.positions.find(p => p.id === positionId);
    return position ? getDutchPositionName(position) : '';
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

  // Check if substitution schedule exists
  const hasSubstitutionSchedule = match?.substitution_schedule && 
    Object.keys(match.substitution_schedule).length > 0;

  // Add debug logging for render conditions
  console.log('🎨 Render conditions check:');
  console.log('- loading:', loading);
  console.log('- match exists:', !!match);
  console.log('- formation exists:', !!formation);
  console.log('- formation positions length:', formation?.positions?.length || 0);
  console.log('- viewMode:', viewMode);

  if (loading) {
    console.log('⏳ Rendering loading state');
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Wedstrijd laden...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!match) {
    console.log('❌ Rendering no match found state');
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Wedstrijd niet gevonden</Text>
        </View>
      </SafeAreaView>
    );
  }

  console.log('✅ Rendering main match screen');

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
        
        {/* Add Substitution Schedule Button */}
        {hasSubstitutionSchedule && (
          <TouchableOpacity
            style={styles.scheduleButton}
            onPress={() => router.push(`/substitution-schedule/${match.id}`)}
          >
            <Calendar size={18} color="#FF6B35" />
          </TouchableOpacity>
        )}
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

      {/* Substitution Schedule Quick Access */}
      {hasSubstitutionSchedule && (
        <View style={styles.quickAccessBanner}>
          <View style={styles.quickAccessContent}>
            <Calendar size={16} color="#FF6B35" />
            <Text style={styles.quickAccessText}>
              Wisselschema beschikbaar voor deze wedstrijd
            </Text>
          </View>
          <TouchableOpacity
            style={styles.quickAccessButton}
            onPress={() => router.push(`/substitution-schedule/${match.id}`)}
          >
            <Text style={styles.quickAccessButtonText}>Bekijk Schema</Text>
          </TouchableOpacity>
        </View>
      )}

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
          onPress={() => {
            console.log('🔄 Switching to formation view');
            setViewMode('formation');
          }}
        >
          <Grid3X3 size={16} color={viewMode === 'formation' ? '#FFFFFF' : '#6B7280'} />
          <Text style={[styles.viewModeText, viewMode === 'formation' && styles.activeViewModeText]}>
            Formatie
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.viewModeButton, viewMode === 'list' && styles.activeViewMode]}
          onPress={() => {
            console.log('🔄 Switching to list view');
            setViewMode('list');
          }}
        >
          <Users size={16} color={viewMode === 'list' ? '#FFFFFF' : '#6B7280'} />
          <Text style={[styles.viewModeText, viewMode === 'list' && styles.activeViewModeText]}>
            Opstelling
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
                Formatie {formation ? `(${getFormationDisplayName()})` : ''}
              </Text>
            </View>
            
            {(() => {
              console.log('🎯 Formation view render check:');
              console.log('- formation exists:', !!formation);
              console.log('- formation positions:', formation?.positions);
              console.log('- positions length:', formation?.positions?.length || 0);
              
              if (!formation || formation.positions.length === 0) {
                console.log('❌ Rendering empty formation state');
                return (
                  <View style={styles.emptyContainer}>
                    <Grid3X3 size={40} color="#9CA3AF" />
                    <Text style={styles.emptyTitle}>Geen formatie ingesteld</Text>
                    <Text style={styles.emptySubtitle}>
                      Er is geen formatie geselecteerd voor deze wedstrijd
                    </Text>
                  </View>
                );
              } else {
                console.log('✅ Rendering FieldView with formation');
                return (
                  <FieldView
                    positions={formation.positions}
                    lineup={match.lineup}
                    highlightPosition={selectedPosition}
                    onPositionPress={handlePositionPress}
                  />
                );
              }
            })()}

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
                      formation={formation}
                    />
                  ))}
                </View>
              )}
            </View>
          </View>
        ) : (
          /* Two-Column List View */
          <View style={styles.twoColumnContainer}>
            {/* Left Column - Lineup */}
            <View style={styles.column}>
              <View style={styles.columnHeader}>
                <Star size={16} color="#16A34A" />
                <Text style={styles.columnTitle}>Basisopstelling</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{match.lineup.length}</Text>
                </View>
              </View>
              
              {match.lineup.length === 0 ? (
                <View style={styles.emptyColumnContainer}>
                  <User size={24} color="#9CA3AF" />
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
                      formation={formation}
                    />
                  ))}
                </View>
              )}
            </View>

            {/* Right Column - Reserves */}
            <View style={styles.column}>
              <View style={styles.columnHeader}>
                <Users size={16} color="#6B7280" />
                <Text style={styles.columnTitle}>Bank</Text>
                <View style={[styles.countBadge, styles.reserveCountBadge]}>
                  <Text style={[styles.countText, styles.reserveCountText]}>{match.reserve_players.length}</Text>
                </View>
              </View>
              
              {match.reserve_players.length === 0 ? (
                <View style={styles.emptyColumnContainer}>
                  <Users size={24} color="#9CA3AF" />
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
                      formation={formation}
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
  scheduleButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    marginLeft: 8,
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
  quickAccessBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#FECACA',
  },
  quickAccessContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  quickAccessText: {
    fontSize: 13,
    color: '#DC2626',
    fontFamily: 'Inter-Medium',
  },
  quickAccessButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  quickAccessButtonText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
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
  // Two-column layout styles
  twoColumnContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
  },
  column: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 8,
  },
  columnTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    flex: 1,
  },
  countBadge: {
    backgroundColor: '#16A34A',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 24,
    alignItems: 'center',
  },
  reserveCountBadge: {
    backgroundColor: '#6B7280',
  },
  countText: {
    fontSize: 11,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  reserveCountText: {
    color: '#FFFFFF',
  },
  emptyColumnContainer: {
    alignItems: 'center',
    paddingVertical: 32,
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
    padding: 8,
    gap: 4,
  },
  compactPlayerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 8,
  },
  selectedPlayerCard: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  substitutingPlayerCard: {
    borderColor: '#FF6B35',
    backgroundColor: '#FEF2F2',
  },
  onFieldPlayerCard: {
    borderColor: '#10B981',
    backgroundColor: '#FFFFFF',
  },
  benchPlayerCard: {
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playerNumberBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerNumberText: {
    fontSize: 9,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  playerInfo: {
    flex: 1,
    minWidth: 0,
  },
  playerName: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 2,
  },
  playerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  positionText: {
    fontSize: 9,
    fontFamily: 'Inter-Medium',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metaSeparator: {
    fontSize: 8,
    color: '#D1D5DB',
    fontFamily: 'Inter-Regular',
  },
  timeText: {
    fontSize: 9,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  statText: {
    fontSize: 8,
    fontFamily: 'Inter-Bold',
    color: '#10B981',
  },
});