import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Player, Substitution, MatchEvent, PlayerStats, FormationPosition } from '@/types/database';
import { Match, Team } from '@/types/match';
import { LiveMatchTimer } from '@/components/LiveMatchTimer';
import FieldView from '@/components/FieldView';
import { convertPlayersDataToArray } from '@/lib/playerUtils';
import { matchEventLogger } from '@/lib/matchEventLogger';
import { 
  ArrowLeft, 
  Users, 
  ArrowUpDown, 
  Star, 
  Grid3x3 as Grid3X3, 
  User, 
  Target, 
  Clock, 
  Calendar,
  Eye,
  Shield
} from 'lucide-react-native';
import TimeControl from '../components/match/TimeControl';
import { getPositionColor, getPositionDisplayName } from '@/lib/playerPositions';
import { styles } from '../styles/match';
import TimeDisplay from '../components/match/TimeDisplay';
import SubstitutionBanner from '../components/match/SubstitutionBanner';
import ViewModeToggle from '../components/match/ViewModeToggle';

const { width: screenWidth } = Dimensions.get('window');

interface Formation {
  id: string;
  key: string;
  players: Player[];
  name_translations: Record<string, string>;
  positions: FormationPosition[];
}

interface SubstitutionData {
  formation_key: string;
  quarters: number;
  substitutions_per_quarter: number;
  subs_per_quarter: number;
  time: number;
  [key: string]: any;
}

interface ParsedSchedule {
  [position: string]: {
    [quarter: number]: Player[];
  };
}

interface TimelineEvent {
  time: number;
  quarter: number;
  position: string;
  slot: number;
  player: Player;
  isSubstitution: boolean;
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

  const getDutchPositionForPlayer = (player: Player): string => {
    if (!formation) {
      return getPositionDisplayName(player.position);
    }

    const formationPosition = formation.positions.find(pos => {
      const dutchName = pos.label_translations?.nl || pos.dutch_name || pos.name;
      return player.position === dutchName || 
             player.position === pos.dutch_name || 
             player.position === pos.name;
    });

    if (formationPosition) {
      return formationPosition.label_translations?.nl || formationPosition.dutch_name || formationPosition.name || player.position;
    }

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
  const [team, setTeam] = useState<Team | null>(null);
  const [formation, setFormation] = useState<Formation | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [isSubstituting, setIsSubstituting] = useState(false);
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>([]);
  const [matchEvents, setMatchEvents] = useState<MatchEvent[]>([]);
  const [viewMode, setViewMode] = useState<'formation' | 'list' | 'timeline' | 'grid'>('timeline');
  
  // Substitution schedule state
  const [scheduleData, setScheduleData] = useState<SubstitutionData | null>(null);
  const [parsedSchedule, setParsedSchedule] = useState<ParsedSchedule>({});
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

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

  const convertPositionsToArray = (positions: any): FormationPosition[] => {
    if (Array.isArray(positions)) {
      return positions;
    }
    
    if (positions && typeof positions === 'object') {
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
        }
      });
      
      positionsArray.sort((a, b) => a.order - b.order);
      return positionsArray;
    }
    
    return [];
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
        const positionsArray = convertPositionsToArray(data.positions);
        const formationObject = {
          ...data,
          positions: positionsArray
        };
        
        setFormation(formationObject);
      }
    } catch (error) {
      console.error('Exception in fetchFormation:', error);
    }
  };

  const parseScheduleData = (data: SubstitutionData) => {
    const parsed: ParsedSchedule = {};
    
    Object.entries(data).forEach(([key, value]) => {
      if (key.includes('-') && typeof value === 'object' && value?.id) {
        const parts = key.split('-');
        if (parts.length >= 3) {
          const position = parts[0];
          const quarter = parseInt(parts[1]);
          const slot = parseInt(parts[2]);

          if (!parsed[position]) {
            parsed[position] = {};
          }
          if (!parsed[position][quarter]) {
            parsed[position][quarter] = [];
          }
          
          parsed[position][quarter][slot] = value as Player;
        }
      }
    });

    setParsedSchedule(parsed);
  };

  const generateTimelineEvents = (data: SubstitutionData) => {
    const events: TimelineEvent[] = [];
    const quarterDuration = 15 * 60;
    const subsPerQuarter = data.subs_per_quarter || data.substitutions_per_quarter || 2;
    
    Object.entries(data).forEach(([key, value]) => {
      if (key.includes('-') && typeof value === 'object' && value?.id) {
        const parts = key.split('-');
        if (parts.length >= 3) {
          const position = parts[0];
          const quarter = parseInt(parts[1]);
          const slot = parseInt(parts[2]);
          
          const quarterStartTime = (quarter - 1) * quarterDuration;
          const slotInterval = quarterDuration / (subsPerQuarter + 1);
          const eventTime = quarterStartTime + slot * slotInterval;
          
          events.push({
            time: eventTime,
            quarter,
            position,
            slot,
            player: value as Player,
            isSubstitution: slot > 0,
          });
        }
      }
    });

    events.sort((a, b) => a.time - b.time);
    setTimelineEvents(events);
  };

  const fetchMatch = async () => {
    try {
      const { data, error } = await supabase
        .from('matches')
        .select(`
          *,
          teams (
            id,
            name,
            players
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
      
      // Set team data
      if (data.teams) {
        setTeam({
          id: data.teams.id,
          name: data.teams.name,
          players: Array.isArray(data.teams.players) ? data.teams.players : [],
          coach: Array.isArray(data.teams.coach) ? data.teams.coach : []
        });
      }
      
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
      setCurrentTime(data.match_time || 0);
      
      // Handle substitution schedule
      if (data.substitution_schedule) {
        setScheduleData(data.substitution_schedule);
        parseScheduleData(data.substitution_schedule);
        generateTimelineEvents(data.substitution_schedule);
      }
      
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

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentTime(prev => {
          const newTime = prev + 1;
          if (newTime >= 60 * 60) {
            setIsPlaying(false);
            return prev;
          }
          return newTime;
        });
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  const updateMatch = async (updates: Partial<Match>) => {
    if (!match) return;

    try {
      console.log('🔄 Updating match with:', updates);
      
      const dbUpdates: Partial<Match> = {};
      Object.keys(updates).forEach(key => {
        dbUpdates[key as keyof Match] = updates[key as keyof Match];
      });

      const { error } = await supabase
        .from('matches')
        .update(dbUpdates)
        .eq('id', match.id);

      if (error) {
        console.error('❌ Database update failed:', error);
        throw error;
      }
      
      console.log('✅ Database update successful');
      setMatch(prev => prev ? { ...prev, ...updates } : null);
      
      return true;
    } catch (error) {
      console.error('💥 Error updating match:', error);
      Alert.alert('Fout', 'Kon wedstrijd niet bijwerken');
      return false;
    }
  };

  const performPlayerSwap = async (player1: Player, player2: Player, isPlayer1OnField: boolean, isPlayer2OnField: boolean) => {
    if (!match) return;

    console.log('🔄 Starting player swap:', {
      player1: { name: player1.name, number: player1.number, onField: isPlayer1OnField },
      player2: { name: player2.name, number: player2.number, onField: isPlayer2OnField }
    });

    try {
      let newLineup = [...match.lineup];
      let newReservePlayers = [...match.reserve_players];
      let newSubstitutions = [...match.substitutions];
      let swapDescription = '';

      if (isPlayer1OnField && isPlayer2OnField) {
        // Both on field - swap positions
        const player1Index = newLineup.findIndex(p => p.id === player1.id);
        const player2Index = newLineup.findIndex(p => p.id === player2.id);
        
        if (player1Index !== -1 && player2Index !== -1) {
          const tempPosition = newLineup[player1Index].position;
          newLineup[player1Index] = { ...newLineup[player1Index], position: newLineup[player2Index].position };
          newLineup[player2Index] = { ...newLineup[player2Index], position: tempPosition };
          
          swapDescription = `Position swap: ${player1.name} and ${player2.name} switched positions`;
          
          // Log the position swap
          await matchEventLogger.logPlayerSwap(
            match.id,
            player1,
            player2,
            currentTime,
            getCurrentQuarter(currentTime),
            player2.position,
            player1.position
          );
        }
      } else if (!isPlayer1OnField && !isPlayer2OnField) {
        // Both on bench - show error
        Alert.alert('Fout', 'Kan geen wissel maken tussen twee reservespelers');
        return;
      } else {
        // One on field, one on bench - substitution
        const fieldPlayer = isPlayer1OnField ? player1 : player2;
        const benchPlayer = isPlayer1OnField ? player2 : player1;
        
        const fieldIndex = newLineup.findIndex(p => p.id === fieldPlayer.id);
        const benchIndex = newReservePlayers.findIndex(p => p.id === benchPlayer.id);
        
        if (fieldIndex !== -1 && benchIndex !== -1) {
          // Create new player objects with swapped positions
          const newFieldPlayer = { ...benchPlayer, position: fieldPlayer.position };
          const newBenchPlayer = { ...fieldPlayer };
          
          // Update arrays
          newLineup[fieldIndex] = newFieldPlayer;
          newReservePlayers[benchIndex] = newBenchPlayer;
          
          // Create substitution record
          const substitution: Substitution = {
            time: currentTime,
            quarter: getCurrentQuarter(currentTime),
            playerIn: benchPlayer,
            playerOut: fieldPlayer,
            timestamp: new Date().toISOString(),
          };
          newSubstitutions.push(substitution);
          
          swapDescription = `Substitution: ${benchPlayer.name} in for ${fieldPlayer.name}`;
          
          // Log the substitution
          await matchEventLogger.logSubstitution(
            match.id,
            benchPlayer,
            fieldPlayer,
            fieldPlayer.position,
            currentTime,
            getCurrentQuarter(currentTime)
          );
        }
      }

      console.log('📊 Swap details:', {
        newLineupCount: newLineup.length,
        newReservesCount: newReservePlayers.length,
        newSubstitutionsCount: newSubstitutions.length,
        description: swapDescription
      });

      // Update the database
      const success = await updateMatch({
        lineup: newLineup,
        reserve_players: newReservePlayers,
        substitutions: newSubstitutions,
      });

      if (success) {
        Alert.alert('Succes', swapDescription);
        console.log('✅ Player swap completed successfully');
      }

    } catch (error) {
      console.error('💥 Error in performPlayerSwap:', error);
      Alert.alert('Fout', 'Kon spelerwissel niet uitvoeren');
    }
  };

  const startMatch = async () => {
    if (match) {
      const success = await updateMatch({ status: 'inProgress' as const });
      if (success) {
        await matchEventLogger.logMatchStart(match.id);
      }
    }
  };

  const pauseMatch = async () => {
    if (match) {
      await updateMatch({ status: 'paused' as const });
    }
  };

  const resumeMatch = async () => {
    if (match) {
      await updateMatch({ status: 'inProgress' as const });
    }
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
          onPress: async () => {
            if (match) {
              const success = await updateMatch({ status: 'completed' });
              if (success) {
                await matchEventLogger.logMatchEnd(
                  match.id,
                  currentTime,
                  getCurrentQuarter(currentTime),
                  { home: match.home_score, away: match.away_score }
                );
              }
            }
          },
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

  const handlePlayerPress = async (player: Player, isOnField: boolean) => {
    console.log('🎯 Player selected:', {
      id: player.id,
      name: player.name,
      number: player.number,
      position: player.position,
      isOnField: isOnField
    });
    
    // Log player selection
    if (match) {
      await matchEventLogger.logPlayerSelection(
        match.id,
        player,
        currentTime,
        getCurrentQuarter(currentTime),
        isOnField ? 'field' : 'bench'
      );
    }
    
    if (selectedPlayer) {
      // Second player selected - perform swap
      const isSelectedOnField = match?.lineup.some(p => p.id === selectedPlayer.id) || false;
      await performPlayerSwap(selectedPlayer, player, isSelectedOnField, isOnField);
      
      // Clear selection
      setSelectedPlayer(null);
      setIsSubstituting(false);
    } else {
      // First player selected
      setSelectedPlayer(player);
      setIsSubstituting(true);
    }
  };

  const getDutchPositionName = (pos: FormationPosition): string => {
    if (pos.label_translations && pos.label_translations.nl) {
      return pos.label_translations.nl;
    }
    
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
    
    let foundPlayer = match.lineup.find(player => player.position === dutchName);
    
    if (!foundPlayer) {
      foundPlayer = match.lineup.find(player => player.position === position.dutch_name);
    }
    
    if (!foundPlayer) {
      foundPlayer = match.lineup.find(player => player.position === position.name);
    }
    
    return foundPlayer || null;
  };

  const getPositionName = (positionId: string): string => {
    if (!formation) return '';
    const position = formation.positions.find(p => p.id === positionId);
    return position ? getDutchPositionName(position) : '';
  };

  const cancelSubstitution = () => {
    setSelectedPosition(null);
    setSelectedPlayer(null);
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

  const hasSubstitutionSchedule = match?.substitution_schedule && 
    Object.keys(match.substitution_schedule).length > 0;

  // Timeline functions
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getCurrentQuarter = (time: number) => {
    return Math.floor(time / (15 * 60)) + 1;
  };

  const getActivePlayersAtTime = (time: number) => {
    const activePlayers: Record<string, Player> = {};
    
    const pastEvents = timelineEvents.filter(event => event.time <= time);
    
    pastEvents.forEach(event => {
      activePlayers[event.position] = event.player;
    });
    
    return activePlayers;
  };

  const getUpcomingSubstitutions = (time: number, lookAhead: number = 120) => {
    return timelineEvents.filter(event => 
      event.time > time && 
      event.time <= time + lookAhead && 
      event.isSubstitution
    );
  };

  const getReservePlayers = (time: number) => {
    // Get all players from the team
    if (!team || !team.players) {
      console.log('🔍 No team data available');
      return [];
    }
    
    const allPlayers = team.players;
    
    console.log('🔍 Debug Reserve Calculation:');
    console.log('Total players:', allPlayers.length);
    console.log('Players in lineup:', match.lineup.length);
    
    // Get currently active players on field
    const activePlayerIds = new Set();
    
    if (Object.entries(activePlayers).length === 0 && time === 0) {
      // At start, lineup players are on field
      match.lineup.forEach(player => activePlayerIds.add(player.id));
      console.log('Using lineup as active players (start of match)');
    } else {
      // Use active players from timeline
      Object.values(activePlayers).forEach(player => activePlayerIds.add(player.id));
      console.log('Using timeline active players');
    }
    
    console.log('Active player IDs:', Array.from(activePlayerIds));
    
    // Return players not currently on field
    const reserves = allPlayers.filter(player => !activePlayerIds.has(player.id));
    console.log('Calculated reserves:', reserves.length, reserves.map(p => p.name));
    
    return reserves;
  };
  const getPositions = () => {
    return Object.keys(parsedSchedule).sort();
  };

  const getQuarters = () => {
    return scheduleData?.quarters ? Array.from({ length: scheduleData.quarters }, (_, i) => i + 1) : [1, 2, 3, 4];
  };

  const getPositionColorForSchedule = (position: string) => {
    const pos = position.toLowerCase();
    if (pos.includes('goalkeeper')) return '#EF4444';
    if (pos.includes('back') || pos.includes('sweeper') || pos.includes('lastline')) return '#3B82F6';
    if (pos.includes('midfield')) return '#8B5CF6';
    if (pos.includes('forward') || pos.includes('striker')) return '#F59E0B';
    return '#6B7280';
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

  const activePlayers = getActivePlayersAtTime(currentTime);
  const upcomingSubstitutions = getUpcomingSubstitutions(currentTime);
  const currentQuarter = getCurrentQuarter(currentTime);
  const reservePlayers = getReservePlayers(currentTime);

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
          <Text style={styles.teamName}>#{match.match_key}</Text>
        </View>      
      </View>

      {/* Time Display - Always visible */}
      <TimeDisplay
        currentTime={currentTime}
        currentQuarter={currentQuarter}
        homeScore={match.home_score}
        awayScore={match.away_score}
        formatTime={formatTime}
      />

      {/* View Mode Toggle */}
      <ViewModeToggle
        hasSubstitutionSchedule={hasSubstitutionSchedule}
        viewMode={viewMode}
        setViewMode={setViewMode}
      />

      {/* Player Selection Banner */}
      {isSubstituting && (
        <View style={styles.swapBanner}>
          <ArrowUpDown size={14} color="#8B5CF6" />
          <Text style={styles.swapText}>
            {selectedPlayer 
              ? `${selectedPlayer.name} (#${selectedPlayer.number}) geselecteerd - kies een andere speler om te wisselen`
              : 'Selecteer een speler om te wisselen'
            }
          </Text>
          <TouchableOpacity onPress={cancelSubstitution}>
            <Text style={styles.cancelText}>Annuleren</Text>
          </TouchableOpacity>
        </View>
      )}
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {viewMode === 'timeline' && hasSubstitutionSchedule ? (
          /* Timeline View */
          <View style={styles.timelineContainer}>
            {/* Dual Column Active Players */}
            <View style={styles.activePlayersSection}>
              <View style={styles.dualColumnContainer}>
                {/* Left Column - Field Players */}
                <View style={styles.liveColumn}>
                  <View style={styles.liveColumnHeader}>
                    <Users size={16} color="#16A34A" />
                    <Text style={styles.liveColumnTitle}>Op het Veld</Text>
                  </View>
                  
                  <View style={styles.livePlayersList}>
                    {Object.entries(activePlayers).length === 0 && currentTime === 0 ? (
                      // Show starting lineup when no timeline events yet, sorted by formation position order
                      match.lineup
                        .sort((a, b) => {
                          const posA = formation?.positions.find(pos => 
                            pos.name === a.position || 
                            pos.dutch_name === a.position ||
                            pos.label_translations?.nl === a.position
                          );
                          const posB = formation?.positions.find(pos => 
                            pos.name === b.position || 
                            pos.dutch_name === b.position ||
                            pos.label_translations?.nl === b.position
                          );
                          return (posA?.order || 999) - (posB?.order || 999);
                        })
                        .map((player) => (
                          <TouchableOpacity 
                            key={player.id} 
                            style={[
                              styles.livePlayerCard,
                              selectedPlayer?.id === player.id && styles.selectedFieldPlayerCard
                            ]}
                            onPress={() => handlePlayerPress(player, true)}
                          >
                            <View style={[styles.livePlayerNumberBadge, { backgroundColor: getPositionColor(player.position) }]}>
                              <Text style={styles.livePlayerNumberText}>#{player.number}</Text>
                            </View>
                            <View style={styles.livePlayerInfo}>
                              <Text style={styles.livePlayerPosition}>
                                {formation?.positions.find(pos => 
                                  pos.name === player.position || 
                                  pos.dutch_name === player.position ||
                                  pos.label_translations?.nl === player.position
                                )?.label_translations?.nl || player.position}
                              </Text>
                              <View style={styles.livePlayerDetails}>
                                <Text style={styles.livePlayerName}>{player.name}</Text>
                                <Text style={styles.livePlayerSubTime}>Start</Text>
                              </View>
                            </View>
                            <View style={styles.livePlayerMeta}>
                              <View style={[styles.conditionDot, { backgroundColor: '#10B981' }]} />
                              {player.position?.toLowerCase().includes('goalkeeper') && <Shield size={12} color="#EF4444" />}
                            </View>
                          </TouchableOpacity>
                        ))
                    ) : (
                      // Show active players from timeline, sorted by formation position order
                      Object.entries(activePlayers)
                        .sort(([positionA], [positionB]) => {
                          const posA = formation?.positions.find(pos => pos.name === positionA);
                          const posB = formation?.positions.find(pos => pos.name === positionB);
                          return (posA?.order || 999) - (posB?.order || 999);
                        })
                        .map(([position, player]) => (
                          <TouchableOpacity 
                            key={position} 
                            style={[
                              styles.livePlayerCard,
                              selectedPlayer?.id === player.id && styles.selectedFieldPlayerCard
                            ]}
                            onPress={() => handlePlayerPress(player, true)}
                          >
                            <View style={[styles.livePlayerNumberBadge, { backgroundColor: getPositionColorForSchedule(position) }]}>
                              <Text style={styles.livePlayerNumberText}>#{player.number}</Text>
                            </View>
                            <View style={styles.livePlayerInfo}>
                              <Text style={styles.livePlayerPosition}>
                                {formation?.positions.find(pos => pos.name === position)?.label_translations?.nl || position}
                              </Text>
                              <View style={styles.livePlayerDetails}>
                                <Text style={styles.livePlayerName}>{player.name}</Text>
                                <Text style={styles.livePlayerSubTime}>
                                  {formatTime(timelineEvents.find(e => e.player.id === player.id && e.position === position)?.time || 0)}
                                </Text>
                              </View>
                            </View>
                            <View style={styles.livePlayerMeta}>
                              <View style={[styles.conditionDot, { 
                                backgroundColor: player.condition && player.condition >= 80 ? '#10B981' : 
                                               player.condition >= 60 ? '#F59E0B' : '#EF4444' 
                              }]} />
                              {player.isGoalkeeper && <Shield size={12} color="#EF4444" />}
                            </View>
                          </TouchableOpacity>
                        ))
                    )}
                  </View>
                </View>

                {/* Right Column - Bench Players */}
                <View style={styles.liveColumn}>
                  <View style={styles.liveColumnHeader}>
                    <Users size={16} color="#6B7280" />
                    <Text style={styles.liveColumnTitle}>Bank ({reservePlayers.length})</Text>
                  </View>
                  
                  <View style={styles.livePlayersList}>
                    {reservePlayers.length === 0 ? (
                      <View style={styles.emptyBenchContainer}>
                        <Users size={24} color="#9CA3AF" />
                        <Text style={styles.emptyBenchText}>Geen reservespelers</Text>
                      </View>
                    ) : (
                      reservePlayers
                        .sort((a, b) => {
                          const posA = formation?.positions.find(pos => 
                            pos.name === a.position || 
                            pos.dutch_name === a.position ||
                            pos.label_translations?.nl === a.position
                          );
                          const posB = formation?.positions.find(pos => 
                            pos.name === b.position || 
                            pos.dutch_name === b.position ||
                            pos.label_translations?.nl === b.position
                          );
                          return (posA?.order || 999) - (posB?.order || 999);
                        })
                        .map((player) => (
                          <TouchableOpacity 
                            key={player.id} 
                            style={[
                              styles.livePlayerCard, 
                              styles.benchPlayerCard,
                              selectedPlayer?.id === player.id && styles.selectedBenchPlayerCard
                            ]}
                            onPress={() => handlePlayerPress(player, false)}
                          >
                            <View style={[styles.livePlayerNumberBadge, { backgroundColor: getPositionColor(player.position) }]}>
                              <Text style={styles.livePlayerNumberText}>#{player.number}</Text>
                            </View>
                            <View style={styles.livePlayerInfo}>
                              <Text style={styles.reserveLabel}>Reserve</Text>
                              <Text style={styles.livePlayerPosition}>
                                {formation?.positions.find(pos => 
                                  pos.name === player.position || 
                                  pos.dutch_name === player.position ||
                                  pos.label_translations?.nl === player.position
                                )?.label_translations?.nl || player.position}
                              </Text>
                              <View style={styles.livePlayerDetails}>
                                <Text style={styles.livePlayerName}>{player.name}</Text>
                              </View>
                            </View>
                            <View style={styles.livePlayerMeta}>
                              <View style={[styles.conditionDot, { backgroundColor: '#6B7280' }]} />
                              {player.position?.toLowerCase().includes('goalkeeper') && <Shield size={12} color="#EF4444" />}
                            </View>
                          </TouchableOpacity>
                        ))
                    )}
                  </View>
                </View>
              </View>
            </View>

            {/* Upcoming Substitutions */}
            {upcomingSubstitutions.length > 0 && (
              <View style={styles.upcomingSection}>
                <Text style={styles.sectionTitle}>Aankomende Wissels</Text>
                <View style={styles.upcomingList}>
                  {upcomingSubstitutions.map((event, index) => (
                    <View key={index} style={styles.upcomingCard}>
                      <View style={styles.upcomingTime}>
                        <Clock size={14} color="#F59E0B" />
                        <Text style={styles.upcomingTimeText}>
                          {formatTime(event.time)}
                        </Text>
                      </View>
                      <View style={styles.upcomingDetails}>
                        <Text style={styles.upcomingPosition}>
                          {getPositionDisplayName(event.position)}
                        </Text>
                        <View style={styles.upcomingPlayer}>
                          <Text style={styles.upcomingPlayerName}>
                            {event.player.name} #{event.player.number}
                          </Text>
                          <Text style={styles.upcomingPlayerAction}>
                            → Komt erin
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        ) : viewMode === 'formation' ? (
          /* Formation View */
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Eye size={18} color="#16A34A" />
              <Text style={styles.sectionTitle}>
                Formatie {formation ? `(${getFormationDisplayName()})` : ''}
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
              <FieldView
                positions={formation.positions}
                lineup={match.lineup}
                highlightPosition={selectedPosition}
                onPositionPress={handlePositionPress}
              />
            )}

            {/* Show Events from database */}
            <View style={styles.reserveSection}>
              <View style={styles.sectionHeader}>
                <Users size={18} color="#6B7280" />
                <Text style={styles.sectionTitle}>Events ({match.reserve_players.length})</Text>
              </View>
              {match.reserve_players.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Users size={28} color="#9CA3AF" />
                  <Text style={styles.emptyText}>Geen events</Text>
                </View>
              ) : (
                <View style={styles.compactPlayersList}>
                  {match.reserve_players.map((player) => (
                    <CompactPlayerCard
                      key={player.id}
                      player={player}
                      stats={getPlayerStats(player.id)}
                      isOnField={false}
                      isSelected={selectedPlayer?.id === player.id}
                      isSubstituting={isSubstituting}
                      onPress={() => handlePlayerPress(player, false)}
                      formation={formation}
                    />
                  ))}
                </View>
              )}
            </View>
          </View>
        ) : viewMode === 'list' ? (
          /* Two-Column List View */
          <View style={styles.twoColumnContainer}>
            {/* Left Column - Lineup */}
            <View style={styles.column}>
              <View style={styles.columnHeader}>
                <Star size={16} color="#16A34A" />
                <Text style={styles.columnTitle}>Basisspelers</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{match.lineup.length}</Text>
                </View>
              </View>
              
              {match.lineup.length === 0 ? (
                <View style={styles.emptyColumnContainer}>
                  <User size={24} color="#9CA3AF" />
                  <Text style={styles.emptyColumnText}>Geen spelers</Text>
                </View>
              ) : (
                <View style={styles.compactPlayersList}>
                  {match.lineup.map((player) => (
                    <CompactPlayerCard
                      key={player.id}
                      player={player}
                      stats={getPlayerStats(player.id)}
                      isOnField={true}
                      isSelected={selectedPlayer?.id === player.id}
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
                      isSelected={selectedPlayer?.id === player.id}
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
          /* Grid View */
          <View style={styles.gridContainer}>
            {/* Header Row */}
            <View style={styles.gridHeader}>
              <View style={styles.positionHeaderCell}>
                <Text style={styles.headerText}>Positie</Text>
              </View>
              {getQuarters().map(quarter => (
                <View key={quarter} style={styles.quarterHeaderCell}>
                  <Text style={styles.headerText}>Q{quarter}</Text>
                </View>
              ))}
            </View>

            {/* Data Rows */}
            {getPositions().map(position => (
              <View key={position} style={styles.gridRow}>
                <View style={styles.positionCell}>
                  <View style={[styles.positionIndicator, { backgroundColor: getPositionColorForSchedule(position) }]} />
                  <Text style={styles.positionName} numberOfLines={2}>
                    {formation?.positions.find(pos => pos.name === position)?.label_translations?.nl || position}
                  </Text>
                </View>
                
                {getQuarters().map(quarter => (
                  <View key={quarter} style={styles.quarterCell}>
                    {parsedSchedule[position]?.[quarter]?.map((player, index) => (
                      player ? (
                        <View key={`${player.id}-${index}`} style={styles.playerChip}>
                          <View style={[styles.playerNumber, { backgroundColor: getPositionColorForSchedule(position) }]}>
                            <Text style={styles.playerNumberText}>{player.number}</Text>
                          </View>
                          <View style={styles.playerDetails}>
                            <Text style={styles.playerName} numberOfLines={1}>
                              {player.name}
                            </Text>
                            <View style={styles.playerMeta}>
                              <View style={styles.conditionIndicator}>
                                <View style={[styles.conditionDot, { 
                                  backgroundColor: player.condition && player.condition >= 80 ? '#10B981' : 
                                                 player.condition >= 60 ? '#F59E0B' : '#EF4444' 
                                }]} />
                                <Text style={styles.conditionValue}>{player.condition ? `${player.condition}%` : 'N/A'}</Text>
                              </View>
                              {player.isGoalkeeper && (
                                <Shield size={10} color="#EF4444" />
                              )}
                            </View>
                          </View>
                        </View>
                      ) : (
                        <View key={index} style={styles.emptySlot}>
                          <Text style={styles.emptySlotText}>-</Text>
                        </View>
                      )
                    )) || (
                      <View style={styles.emptySlot}>
                        <Text style={styles.emptySlotText}>Geen spelers</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Time Control for Schedule */}
      {hasSubstitutionSchedule && match && (
        <TimeControl
          currentTime={currentTime}
          isPlaying={isPlaying}
          setCurrentTime={setCurrentTime}
          setIsPlaying={setIsPlaying}
          home_score={match.home_score}
          away_score={match.away_score}
          onHomeScoreUp={() => {
            setMatch(prev => prev ? {
              ...prev,
              home_score: prev.home_score + 1
            } : null);
          }}
          onHomeScoreDown={() => {
            setMatch(prev => prev ? {
              ...prev,
              home_score: Math.max(0, prev.home_score - 1)
            } : null);
          }}
          onAwayScoreUp={() => {
            setMatch(prev => prev ? {
              ...prev,
              away_score: prev.away_score + 1
            } : null);
          }}
          onAwayScoreDown={() => {
            setMatch(prev => prev ? {
              ...prev,
              away_score: Math.max(0, prev.away_score - 1)
            } : null);
          }}
        />
      )}
    </SafeAreaView>
  );
}