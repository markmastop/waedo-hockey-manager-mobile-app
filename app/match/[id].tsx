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
  Calendar,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Eye,
  Shield
} from 'lucide-react-native';
import { getPositionColor, getPositionDisplayName } from '@/lib/playerPositions';

const { width: screenWidth } = Dimensions.get('window');

interface Formation {
  id: string;
  key: string;
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
  const [formation, setFormation] = useState<Formation | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null);
  const [isSubstituting, setIsSubstituting] = useState(false);
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>([]);
  const [matchEvents, setMatchEvents] = useState<MatchEvent[]>([]);
  const [viewMode, setViewMode] = useState<'formation' | 'list' | 'timeline'>('timeline');
  
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
          const eventTime = quarterStartTime + (slot + 1) * slotInterval;
          
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

  const getPositions = () => {
    return Object.keys(parsedSchedule).sort();
  };

  const getQuarters = () => {
    return scheduleData?.quarters ? Array.from({ length: scheduleData.quarters }, (_, i) => i + 1) : [1, 2, 3, 4];
  };

  const getPositionDisplayName = (position: string) => {
    const positionMap: Record<string, string> = {
      'striker': 'Aanvaller',
      'sweeper': 'Libero',
      'lastLine': 'Laatste Lijn',
      'leftBack': 'Linksback',
      'rightBack': 'Rechtsback',
      'leftMidfield': 'Linksmidden',
      'rightMidfield': 'Rechtsmidden',
      'centerMidfield': 'Middenmidden',
      'leftForward': 'Linksvoorwaarts',
      'rightForward': 'Rechtsvoorwaarts',
      'goalkeeper': 'Keeper',
    };
    return positionMap[position] || position;
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

      {/* Time Control for Schedule */}
      {hasSubstitutionSchedule && viewMode === 'timeline' && (
        <View style={styles.timeControl}>
          <View style={styles.timeDisplay}>
            <Text style={styles.currentTimeText}>{formatTime(currentTime)}</Text>
            <Text style={styles.quarterText}>Kwart {currentQuarter}</Text>
          </View>
          
          <View style={styles.playControls}>
            <TouchableOpacity 
              style={styles.controlButton}
              onPress={() => setCurrentTime(Math.max(0, currentTime - 60))}
            >
              <ChevronLeft size={16} color="#6B7280" />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.controlButton, styles.playButton]}
              onPress={() => setIsPlaying(!isPlaying)}
            >
              {isPlaying ? (
                <Pause size={16} color="#FFFFFF" />
              ) : (
                <Play size={16} color="#FFFFFF" />
              )}
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.controlButton}
              onPress={() => setCurrentTime(Math.min(60 * 60, currentTime + 60))}
            >
              <ChevronRight size={16} color="#6B7280" />
            </TouchableOpacity>
          </View>
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
        {hasSubstitutionSchedule && (
          <TouchableOpacity
            style={[styles.viewModeButton, viewMode === 'timeline' && styles.activeViewMode]}
            onPress={() => setViewMode('timeline')}
          >
            <Clock size={16} color={viewMode === 'timeline' ? '#FFFFFF' : '#6B7280'} />
            <Text style={[styles.viewModeText, viewMode === 'timeline' && styles.activeViewModeText]}>
              Live
            </Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity
          style={[styles.viewModeButton, viewMode === 'formation' && styles.activeViewMode]}
          onPress={() => setViewMode('formation')}
        >
          <Eye size={16} color={viewMode === 'formation' ? '#FFFFFF' : '#6B7280'} />
          <Text style={[styles.viewModeText, viewMode === 'formation' && styles.activeViewModeText]}>
            Veld
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

        {hasSubstitutionSchedule && (
          <TouchableOpacity
            style={[styles.viewModeButton, viewMode === 'grid' && styles.activeViewMode]}
            onPress={() => setViewMode('grid')}
          >
            <Grid3X3 size={16} color={viewMode === 'grid' ? '#FFFFFF' : '#6B7280'} />
            <Text style={[styles.viewModeText, viewMode === 'grid' && styles.activeViewModeText]}>
              Schema
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {viewMode === 'timeline' && hasSubstitutionSchedule ? (
          /* Timeline View */
          <View style={styles.timelineContainer}>
            {/* Current Active Players */}
            <View style={styles.activePlayersSection}>
              <Text style={styles.sectionTitle}>Huidige Opstelling ({formatTime(currentTime)})</Text>
              <View style={styles.activePlayersList}>
                {Object.entries(activePlayers).map(([position, player]) => (
                  <View key={position} style={styles.activePlayerCard}>
                    <View style={[styles.positionIndicator, { backgroundColor: getPositionColorForSchedule(position) }]} />
                    <View style={styles.activePlayerInfo}>
                      <Text style={styles.activePlayerPosition}>
                        {getPositionDisplayName(position)}
                      </Text>
                      <View style={styles.activePlayerDetails}>
                        <Text style={styles.activePlayerName}>{player.name}</Text>
                        <Text style={styles.activePlayerNumber}>#{player.number}</Text>
                      </View>
                    </View>
                    <View style={styles.activePlayerMeta}>
                      <View style={[styles.conditionDot, { 
                        backgroundColor: player.condition >= 80 ? '#10B981' : 
                                       player.condition >= 60 ? '#F59E0B' : '#EF4444' 
                      }]} />
                      {player.isGoalkeeper && <Shield size={12} color="#EF4444" />}
                    </View>
                  </View>
                ))}
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
        ) : viewMode === 'list' ? (
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
                    {getPositionDisplayName(position)}
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
                                  backgroundColor: player.condition >= 80 ? '#10B981' : 
                                                 player.condition >= 60 ? '#F59E0B' : '#EF4444' 
                                }]} />
                                <Text style={styles.conditionValue}>{player.condition}%</Text>
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
  timeControl: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  timeDisplay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  currentTimeText: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  quarterText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
  },
  playControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  controlButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    backgroundColor: '#FF6B35',
    width: 48,
    height: 48,
    borderRadius: 24,
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
  // Timeline View Styles
  timelineContainer: {
    padding: 16,
  },
  activePlayersSection: {
    marginBottom: 24,
  },
  activePlayersList: {
    gap: 8,
  },
  activePlayerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  activePlayerInfo: {
    flex: 1,
  },
  activePlayerPosition: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
    marginBottom: 4,
  },
  activePlayerDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activePlayerName: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  activePlayerNumber: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  activePlayerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  positionIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  conditionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  upcomingSection: {
    marginBottom: 24,
  },
  upcomingList: {
    gap: 8,
  },
  upcomingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FED7AA',
    gap: 12,
  },
  upcomingTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  upcomingTimeText: {
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    color: '#D97706',
  },
  upcomingDetails: {
    flex: 1,
  },
  upcomingPosition: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#92400E',
    marginBottom: 2,
  },
  upcomingPlayer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  upcomingPlayerName: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  upcomingPlayerAction: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#D97706',
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
  // Grid View Styles
  gridContainer: {
    padding: 16,
  },
  gridHeader: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  positionHeaderCell: {
    width: 120,
    padding: 12,
    justifyContent: 'center',
  },
  quarterHeaderCell: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
    borderLeftWidth: 1,
    borderLeftColor: '#E5E7EB',
  },
  headerText: {
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    color: '#374151',
    textAlign: 'center',
  },
  gridRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 80,
  },
  positionCell: {
    width: 120,
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#F3F4F6',
  },
  positionName: {
    fontSize: 11,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
    textAlign: 'center',
    marginTop: 4,
  },
  quarterCell: {
    flex: 1,
    padding: 8,
    gap: 4,
    borderLeftWidth: 1,
    borderLeftColor: '#F3F4F6',
  },
  playerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 6,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 4,
  },
  playerNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerDetails: {
    flex: 1,
    minWidth: 0,
  },
  conditionIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  conditionValue: {
    fontSize: 8,
    color: '#6B7280',
    fontFamily: 'Inter-Regular',
  },
  emptySlot: {
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySlotText: {
    fontSize: 10,
    color: '#9CA3AF',
    fontFamily: 'Inter-Regular',
  },
});