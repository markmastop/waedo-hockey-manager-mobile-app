import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Player, FormationPosition, PlayerStats } from '@/types/database';
import { convertPlayersDataToArray } from '@/lib/playerUtils';
import { matchEventLogger } from '@/lib/matchEventLogger';
import { ArrowLeft, Play, Pause, Square, Users, Eye, Clock, Grid3x3 as Grid3X3, ArrowUpDown, Target, Plus, Minus, ChevronLeft, ChevronRight, RefreshCw, Star, UserCheck, Hash } from 'lucide-react-native';
import { styles } from '@/app/styles/match';
import FieldView from '@/components/FieldView';
import { CompactPlayerCard } from '@/components/CompactPlayerCard';
import { LivePlayerCard } from '@/components/LivePlayerCard';
import { PositionCard } from '@/components/PositionCard';
import { LiveMatchTimer } from '@/components/LiveMatchTimer';
import { MatchEventLogger } from '@/components/MatchEventLogger';
import { SubstitutionScheduleDisplay } from '@/components/SubstitutionScheduleDisplay';
import TimeDisplay from '@/components/match/TimeDisplay';
import TimeControl from '@/components/match/TimeControl';
import ViewModeToggle from '@/components/match/ViewModeToggle';
import SubstitutionBanner from '@/components/match/SubstitutionBanner';

interface Match {
  id: string;
  team_id: string;
  date: string;
  home_team: string;
  away_team: string;
  location: string;
  field: string;
  formation: string;
  formation_key?: string;
  match_key?: string;
  lineup: Player[];
  reserve_players: Player[];
  substitutions: any[];
  substitution_schedule: any;
  match_events: any[];
  player_stats: PlayerStats[];
  match_time: number;
  current_quarter: number;
  quarter_times: number[];
  status: 'upcoming' | 'inProgress' | 'paused' | 'completed';
  is_home: boolean;
  home_score: number;
  away_score: number;
  created_at: string;
  teams: {
    name: string;
  };
}

type ViewMode = 'formation' | 'list' | 'timeline' | 'grid';

export default function MatchDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [match, setMatch] = useState<Match | null>(null);
  const [formation, setFormation] = useState<FormationPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('formation');
  
  // Live match state
  const [currentTime, setCurrentTime] = useState(0);
  const [currentQuarter, setCurrentQuarter] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  
  // Substitution state
  const [isSubstituting, setIsSubstituting] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [isSwapping, setIsSwapping] = useState(false);
  const [swapPlayer1, setSwapPlayer1] = useState<Player | null>(null);
  const [swapPlayer2, setSwapPlayer2] = useState<Player | null>(null);

  // Timer ref for live updates
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchMatch = async () => {
    try {
      const { data, error } = await supabase
        .from('matches')
        .select(`
          *,
          teams (name)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      if (data) {
        const lineupArray = convertPlayersDataToArray(data.lineup);
        const reserveArray = convertPlayersDataToArray(data.reserve_players);
        
        const matchData: Match = {
          ...data,
          lineup: lineupArray,
          reserve_players: reserveArray,
          player_stats: Array.isArray(data.player_stats) ? data.player_stats : [],
          home_score: data.home_score || 0,
          away_score: data.away_score || 0,
        };

        setMatch(matchData);
        setCurrentTime(matchData.match_time || 0);
        setCurrentQuarter(matchData.current_quarter || 1);
        setHomeScore(matchData.home_score || 0);
        setAwayScore(matchData.away_score || 0);

        // Fetch formation if available
        if (matchData.formation_key || matchData.formation) {
          await fetchFormation(matchData.formation_key || matchData.formation);
        }
      }
    } catch (error) {
      console.error('Error fetching match:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchFormation = async (formationKey: string) => {
    try {
      console.log('🔍 Fetching formation with key:', formationKey);
      
      const { data, error } = await supabase
        .from('formations')
        .select('*')
        .eq('key', formationKey)
        .single();

      if (error) {
        console.error('❌ Error fetching formation:', error);
        return;
      }

      if (data && data.positions) {
        console.log('✅ Formation data received:', data);
        console.log('📍 Positions data:', data.positions);
        
        let positions: FormationPosition[] = [];
        
        if (Array.isArray(data.positions)) {
          positions = data.positions;
        } else if (typeof data.positions === 'object') {
          positions = Object.values(data.positions);
        }
        
        console.log('📋 Processed positions:', positions);
        setFormation(positions);
      } else {
        console.warn('⚠️ No positions found in formation data');
      }
    } catch (error) {
      console.error('💥 Exception fetching formation:', error);
    }
  };

  useEffect(() => {
    if (id) {
      fetchMatch();
    }
  }, [id]);

  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        setCurrentTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isPlaying]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchMatch();
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getPositionName = (position: string) => {
    const pos = formation.find(p => p.id === position);
    return pos?.dutch_name || pos?.name || position;
  };

  const handlePositionPress = (position: FormationPosition) => {
    if (isSubstituting) {
      setSelectedPosition(position.id);
      
      if (selectedPlayer) {
        handleSubstitution(selectedPlayer, position.id);
      }
    }
  };

  const handlePlayerPress = (player: Player) => {
    if (isSubstituting) {
      setSelectedPlayer(player);
      
      if (selectedPosition) {
        handleSubstitution(player, selectedPosition);
      }
    } else if (isSwapping) {
      if (!swapPlayer1) {
        setSwapPlayer1(player);
      } else if (!swapPlayer2 && player.id !== swapPlayer1.id) {
        setSwapPlayer2(player);
        handlePlayerSwap(swapPlayer1, player);
      }
    }
  };

  const handleSubstitution = async (player: Player, positionId: string) => {
    if (!match) return;

    try {
      const positionName = getPositionName(positionId);
      
      // Find current player in that position
      const currentPlayerInPosition = match.lineup.find(p => p.position === positionName);
      
      if (currentPlayerInPosition) {
        // Log the substitution
        await matchEventLogger.logSubstitution(
          match.id,
          player,
          currentPlayerInPosition,
          positionName,
          currentTime,
          currentQuarter
        );

        // Update local state
        const newLineup = match.lineup.map(p => 
          p.id === currentPlayerInPosition.id 
            ? { ...player, position: positionName }
            : p
        );
        
        const newReserves = match.reserve_players.filter(p => p.id !== player.id);
        if (currentPlayerInPosition) {
          newReserves.push({ ...currentPlayerInPosition, position: currentPlayerInPosition.position });
        }

        setMatch(prev => prev ? {
          ...prev,
          lineup: newLineup,
          reserve_players: newReserves
        } : null);

        // Update database
        await supabase
          .from('matches')
          .update({
            lineup: newLineup,
            reserve_players: newReserves
          })
          .eq('id', match.id);

        Alert.alert('Wissel voltooid', `${player.name} is gewisseld naar ${positionName}`);
      }
    } catch (error) {
      console.error('Error during substitution:', error);
      Alert.alert('Fout', 'Er is een fout opgetreden bij de wissel');
    } finally {
      setIsSubstituting(false);
      setSelectedPosition(null);
      setSelectedPlayer(null);
    }
  };

  const handlePlayerSwap = async (player1: Player, player2: Player) => {
    if (!match) return;

    try {
      // Log the swap
      await matchEventLogger.logPlayerSwap(
        match.id,
        player1,
        player2,
        currentTime,
        currentQuarter,
        player1.position,
        player2.position
      );

      // Swap positions
      const newLineup = match.lineup.map(p => {
        if (p.id === player1.id) {
          return { ...p, position: player2.position };
        } else if (p.id === player2.id) {
          return { ...p, position: player1.position };
        }
        return p;
      });

      setMatch(prev => prev ? { ...prev, lineup: newLineup } : null);

      // Update database
      await supabase
        .from('matches')
        .update({ lineup: newLineup })
        .eq('id', match.id);

      Alert.alert('Wissel voltooid', `${player1.name} en ${player2.name} hebben van positie gewisseld`);
    } catch (error) {
      console.error('Error during player swap:', error);
      Alert.alert('Fout', 'Er is een fout opgetreden bij de wissel');
    } finally {
      setIsSwapping(false);
      setSwapPlayer1(null);
      setSwapPlayer2(null);
    }
  };

  const handleGoal = async (player: Player) => {
    if (!match) return;

    try {
      const previousHomeScore = homeScore;
      const previousAwayScore = awayScore;
      
      // Determine which team scored based on match.is_home
      const newHomeScore = match.is_home ? homeScore + 1 : homeScore;
      const newAwayScore = match.is_home ? awayScore : awayScore + 1;
      const teamScored = match.is_home ? 'home' : 'away';

      // Update local state immediately
      setHomeScore(newHomeScore);
      setAwayScore(newAwayScore);

      // Log the goal
      await matchEventLogger.logGoal(
        match.id,
        player,
        currentTime,
        currentQuarter
      );

      // Log the score change
      await matchEventLogger.logScoreChange(
        match.id,
        currentTime,
        currentQuarter,
        newHomeScore,
        newAwayScore,
        previousHomeScore,
        previousAwayScore,
        teamScored
      );

      // Update database
      await supabase
        .from('matches')
        .update({
          home_score: newHomeScore,
          away_score: newAwayScore
        })
        .eq('id', match.id);

      // Update match state
      setMatch(prev => prev ? {
        ...prev,
        home_score: newHomeScore,
        away_score: newAwayScore
      } : null);

    } catch (error) {
      console.error('Error registering goal:', error);
      Alert.alert('Fout', 'Er is een fout opgetreden bij het registreren van het doelpunt');
      
      // Revert local state on error
      setHomeScore(homeScore);
      setAwayScore(awayScore);
    }
  };

  const handleScoreUp = (team: 'home' | 'away') => {
    const previousHomeScore = homeScore;
    const previousAwayScore = awayScore;
    
    if (team === 'home') {
      const newScore = homeScore + 1;
      setHomeScore(newScore);
      
      // Log score change
      matchEventLogger.logScoreChange(
        match?.id || '',
        currentTime,
        currentQuarter,
        newScore,
        awayScore,
        previousHomeScore,
        previousAwayScore,
        'home'
      );
    } else {
      const newScore = awayScore + 1;
      setAwayScore(newScore);
      
      // Log score change
      matchEventLogger.logScoreChange(
        match?.id || '',
        currentTime,
        currentQuarter,
        homeScore,
        newScore,
        previousHomeScore,
        previousAwayScore,
        'away'
      );
    }
  };

  const handleScoreDown = (team: 'home' | 'away') => {
    const previousHomeScore = homeScore;
    const previousAwayScore = awayScore;
    
    if (team === 'home' && homeScore > 0) {
      const newScore = homeScore - 1;
      setHomeScore(newScore);
      
      // Log score change
      matchEventLogger.logScoreChange(
        match?.id || '',
        currentTime,
        currentQuarter,
        newScore,
        awayScore,
        previousHomeScore,
        previousAwayScore,
        'home'
      );
    } else if (team === 'away' && awayScore > 0) {
      const newScore = awayScore - 1;
      setAwayScore(newScore);
      
      // Log score change
      matchEventLogger.logScoreChange(
        match?.id || '',
        currentTime,
        currentQuarter,
        homeScore,
        newScore,
        previousHomeScore,
        previousAwayScore,
        'away'
      );
    }
  };

  const isPlayerOnField = (player: Player): boolean => {
    return match?.lineup.some(p => p.id === player.id) || false;
  };

  const getPlayerStats = (playerId: string): PlayerStats | undefined => {
    return match?.player_stats?.find(stat => stat.playerId === playerId);
  };

  const hasSubstitutionSchedule = match?.substitution_schedule && 
    Object.keys(match.substitution_schedule).length > 0;

  const renderPlayerCard = (player: Player, isOnField: boolean) => {
    const isSelected = selectedPlayer?.id === player.id || 
                     swapPlayer1?.id === player.id || 
                     swapPlayer2?.id === player.id;
    const stats = getPlayerStats(player.id);

    return (
      <View key={player.id} style={styles.playerCardContainer}>
        <TouchableOpacity
          style={[
            styles.compactPlayerCard,
            isSelected && styles.selectedPlayerCard,
            isOnField ? styles.onFieldPlayerCard : styles.benchPlayerCard,
          ]}
          onPress={() => handlePlayerPress(player)}
        >
          <View style={styles.playerRow}>
            <View style={[
              styles.playerNumberBadge,
              { backgroundColor: '#FF6B35' }
            ]}>
              <Text style={styles.playerNumberText}>#{player.number || '?'}</Text>
            </View>
            
            <View style={styles.playerInfo}>
              <Text style={styles.playerName} numberOfLines={1}>{player.name}</Text>
              <View style={styles.playerMeta}>
                <Text style={styles.positionText}>
                  {player.position}
                </Text>
                {stats && stats.timeOnField > 0 && (
                  <>
                    <Text style={styles.metaSeparator}>•</Text>
                    <Text style={styles.timeText}>{formatTime(stats.timeOnField)}</Text>
                  </>
                )}
              </View>
            </View>

            {isOnField && (
              <Star size={12} color="#10B981" fill="#10B981" />
            )}
          </View>
        </TouchableOpacity>
        
        {/* Goal Button - Only show for players on the field */}
        {isOnField && (
          <TouchableOpacity
            style={styles.goalButton}
            onPress={() => handleGoal(player)}
          >
            <Target size={14} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>
    );
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
        {match.match_key && (
          <View style={styles.matchKeyBadge}>
            <Hash size={12} color="#8B5CF6" />
            <Text style={styles.matchKeyText}>{match.match_key}</Text>
          </View>
        )}
      </View>

      <TimeDisplay
        currentTime={currentTime}
        currentQuarter={currentQuarter}
        homeScore={homeScore}
        awayScore={awayScore}
        formatTime={formatTime}
      />

      <SubstitutionBanner
        isSubstituting={isSubstituting}
        selectedPosition={selectedPosition}
        selectedPlayer={selectedPlayer}
        getPositionName={getPositionName}
        onDismiss={() => {
          setIsSubstituting(false);
          setSelectedPosition(null);
          setSelectedPlayer(null);
        }}
      />

      <ViewModeToggle
        hasSubstitutionSchedule={hasSubstitutionSchedule}
        viewMode={viewMode}
        setViewMode={setViewMode}
      />

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {viewMode === 'formation' && formation.length > 0 && (
          <View style={styles.section}>
            <FieldView
              positions={formation}
              lineup={match.lineup}
              onPositionPress={handlePositionPress}
              highlightPosition={selectedPosition}
            />
          </View>
        )}

        {viewMode === 'list' && (
          <View style={styles.twoColumnContainer}>
            <View style={styles.column}>
              <View style={styles.columnHeader}>
                <Users size={16} color="#16A34A" />
                <Text style={styles.columnTitle}>Op het veld</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{match.lineup.length}</Text>
                </View>
              </View>
              
              {match.lineup.length === 0 ? (
                <View style={styles.emptyColumnContainer}>
                  <Users size={24} color="#9CA3AF" />
                  <Text style={styles.emptyColumnText}>Geen spelers op het veld</Text>
                </View>
              ) : (
                <View style={styles.compactPlayersList}>
                  {match.lineup.map((player) => renderPlayerCard(player, true))}
                </View>
              )}
            </View>

            <View style={styles.column}>
              <View style={styles.columnHeader}>
                <Users size={16} color="#6B7280" />
                <Text style={styles.columnTitle}>Reserves</Text>
                <View style={[styles.countBadge, styles.reserveCountBadge]}>
                  <Text style={[styles.countText, styles.reserveCountText]}>
                    {match.reserve_players.length}
                  </Text>
                </View>
              </View>
              
              {match.reserve_players.length === 0 ? (
                <View style={styles.emptyColumnContainer}>
                  <Users size={24} color="#9CA3AF" />
                  <Text style={styles.emptyColumnText}>Geen reserves</Text>
                </View>
              ) : (
                <View style={styles.compactPlayersList}>
                  {match.reserve_players.map((player) => renderPlayerCard(player, false))}
                </View>
              )}
            </View>
          </View>
        )}

        {viewMode === 'timeline' && hasSubstitutionSchedule && (
          <View style={styles.section}>
            <SubstitutionScheduleDisplay
              substitutionSchedule={match.substitution_schedule}
              currentTime={currentTime}
              currentQuarter={currentQuarter}
            />
          </View>
        )}
      </ScrollView>

      <TimeControl
        currentTime={currentTime}
        isPlaying={isPlaying}
        setCurrentTime={setCurrentTime}
        setIsPlaying={setIsPlaying}
        home_score={homeScore}
        away_score={awayScore}
        onHomeScoreUp={() => handleScoreUp('home')}
        onHomeScoreDown={() => handleScoreDown('home')}
        onAwayScoreUp={() => handleScoreUp('away')}
        onAwayScoreDown={() => handleScoreDown('away')}
      />
    </SafeAreaView>
  );
}