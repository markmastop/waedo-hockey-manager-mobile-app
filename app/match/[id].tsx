import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Player, FormationPosition, PlayerStats } from '@/types/database';
import { convertPlayersDataToArray } from '@/lib/playerUtils';
import { matchEventLogger } from '@/lib/matchEventLogger';
import { ArrowLeft, Calendar, Settings, Clock, Eye, Users, Grid3x3 as Grid3X3 } from 'lucide-react-native';
import { styles as matchStyles } from '@/app/styles/match';

// Import components
import FieldView from '@/components/FieldView';
import { CompactPlayerCard } from '@/components/CompactPlayerCard';
import { LiveMatchTimer } from '@/components/LiveMatchTimer';
import { MatchEventLogger } from '@/components/MatchEventLogger';
import { SubstitutionScheduleDisplay } from '@/components/SubstitutionScheduleDisplay';
import SubstitutionBanner from '@/components/match/SubstitutionBanner';
import ViewModeToggle from '@/components/match/ViewModeToggle';
import TimeDisplay from '@/components/match/TimeDisplay';
import TimeControl from '@/components/match/TimeControl';

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
  
  // State management
  const [match, setMatch] = useState<Match | null>(null);
  const [formations, setFormations] = useState<FormationPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('formation');
  
  // Match state
  const [currentTime, setCurrentTime] = useState(0);
  const [currentQuarter, setCurrentQuarter] = useState(1);
  const [quarterTimes, setQuarterTimes] = useState<number[]>([0, 0, 0, 0]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  
  // Substitution state
  const [isSubstituting, setIsSubstituting] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [highlightPosition, setHighlightPosition] = useState<string | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchMatchDetails = async () => {
    if (!id) return;

    try {
      console.log('🔍 Fetching match details for:', id);
      
      // Fetch match data with player_stats
      const { data: matchData, error: matchError } = await supabase
        .from('matches')
        .select(`
          *,
          teams (name),
          player_stats
        `)
        .eq('id', id)
        .single();

      if (matchError) throw matchError;

      if (!matchData) {
        console.error('❌ No match found');
        return;
      }

      console.log('✅ Match data fetched:', matchData);

      // Process player arrays
      const processedMatch = {
        ...matchData,
        lineup: convertPlayersDataToArray(matchData.lineup),
        reserve_players: convertPlayersDataToArray(matchData.reserve_players),
        player_stats: Array.isArray(matchData.player_stats) ? matchData.player_stats : [],
      };

      setMatch(processedMatch);
      setCurrentTime(matchData.match_time || 0);
      setCurrentQuarter(matchData.current_quarter || 1);
      setQuarterTimes(matchData.quarter_times || [0, 0, 0, 0]);
      setHomeScore(matchData.home_score || 0);
      setAwayScore(matchData.away_score || 0);

      // Fetch formation data if available
      if (matchData.formation_key || matchData.formation) {
        await fetchFormationData(matchData.formation_key || matchData.formation);
      }

    } catch (error) {
      console.error('💥 Error fetching match details:', error);
      Alert.alert('Error', 'Failed to load match details');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchFormationData = async (formationKey: string) => {
    try {
      console.log('🔍 Fetching formation data for:', formationKey);
      
      const { data: formationData, error: formationError } = await supabase
        .from('formations')
        .select('*')
        .eq('key', formationKey)
        .single();

      if (formationError) {
        console.warn('⚠️ Formation not found:', formationError);
        return;
      }

      if (formationData?.positions) {
        console.log('✅ Formation positions loaded:', formationData.positions.length);
        setFormations(formationData.positions);
      }
    } catch (error) {
      console.error('💥 Error fetching formation:', error);
    }
  };

  useEffect(() => {
    fetchMatchDetails();
  }, [id]);

  // Timer management
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
    fetchMatchDetails();
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getPositionName = (position: string) => {
    const formationPosition = formations.find(pos => pos.id === position);
    return formationPosition?.dutch_name || formationPosition?.name || position;
  };

  // Score management
  const handleScoreChange = async (team: 'home' | 'away', change: number) => {
    if (!match) return;

    const previousHomeScore = homeScore;
    const previousAwayScore = awayScore;
    
    const newHomeScore = team === 'home' ? Math.max(0, homeScore + change) : homeScore;
    const newAwayScore = team === 'away' ? Math.max(0, awayScore + change) : awayScore;
    
    setHomeScore(newHomeScore);
    setAwayScore(newAwayScore);

    // Log score change
    try {
      await matchEventLogger.logScoreChange(
        match.id,
        currentTime,
        currentQuarter,
        newHomeScore,
        newAwayScore,
        previousHomeScore,
        previousAwayScore,
        team
      );
    } catch (error) {
      console.error('Error logging score change:', error);
    }
  };

  // Match control functions
  const handleMatchStart = async () => {
    if (!match) return;
    
    setIsPlaying(true);
    try {
      await matchEventLogger.logMatchStart(match.id);
    } catch (error) {
      console.error('Error logging match start:', error);
    }
  };

  const handleMatchPause = async () => {
    setIsPlaying(false);
    if (match) {
      try {
        await matchEventLogger.updateMatchStatus(match.id, 'paused', currentTime, currentQuarter);
      } catch (error) {
        console.error('Error updating match status:', error);
      }
    }
  };

  const handleMatchResume = async () => {
    setIsPlaying(true);
    if (match) {
      try {
        await matchEventLogger.updateMatchStatus(match.id, 'inProgress', currentTime, currentQuarter);
      } catch (error) {
        console.error('Error updating match status:', error);
      }
    }
  };

  const handleMatchEnd = async () => {
    setIsPlaying(false);
    if (match) {
      try {
        await matchEventLogger.logMatchEnd(
          match.id, 
          currentTime, 
          currentQuarter, 
          { home: homeScore, away: awayScore }
        );
      } catch (error) {
        console.error('Error logging match end:', error);
      }
    }
  };

  const handleNextQuarter = async () => {
    if (currentQuarter < 4) {
      const newQuarter = currentQuarter + 1;
      setCurrentQuarter(newQuarter);
      
      if (match) {
        try {
          await matchEventLogger.logQuarterEnd(match.id, currentQuarter, currentTime);
          await matchEventLogger.logQuarterStart(match.id, newQuarter, currentTime);
        } catch (error) {
          console.error('Error logging quarter change:', error);
        }
      }
    }
  };

  // Player selection and substitution
  const handlePlayerPress = async (player: Player) => {
    if (!match) return;

    const isOnField = match.lineup.some(p => p.id === player.id);
    
    try {
      await matchEventLogger.logPlayerSelection(
        match.id,
        player,
        currentTime,
        currentQuarter,
        isOnField ? 'field' : 'bench'
      );
    } catch (error) {
      console.error('Error logging player selection:', error);
    }

    if (isSubstituting) {
      if (selectedPlayer && selectedPlayer.id !== player.id) {
        // Perform substitution
        await performSubstitution(selectedPlayer, player);
      } else {
        setSelectedPlayer(player);
      }
    } else {
      setSelectedPlayer(player);
    }
  };

  const performSubstitution = async (playerOut: Player, playerIn: Player) => {
    if (!match) return;

    try {
      await matchEventLogger.logPlayerSwap(
        match.id,
        playerIn,
        playerOut,
        currentTime,
        currentQuarter,
        selectedPosition || undefined,
        selectedPosition || undefined
      );

      // Update local state
      const newLineup = [...match.lineup];
      const newReserves = [...match.reserve_players];
      
      const outIndex = newLineup.findIndex(p => p.id === playerOut.id);
      const inIndex = newReserves.findIndex(p => p.id === playerIn.id);
      
      if (outIndex !== -1 && inIndex !== -1) {
        newLineup[outIndex] = playerIn;
        newReserves[inIndex] = playerOut;
        
        setMatch({
          ...match,
          lineup: newLineup,
          reserve_players: newReserves,
        });
      }

      // Reset substitution state
      setIsSubstituting(false);
      setSelectedPlayer(null);
      setSelectedPosition(null);
      setHighlightPosition(null);
    } catch (error) {
      console.error('Error performing substitution:', error);
    }
  };

  const dismissSubstitution = () => {
    setIsSubstituting(false);
    setSelectedPlayer(null);
    setSelectedPosition(null);
    setHighlightPosition(null);
  };

  // Get player statistics
  const getPlayerStats = (playerId: string): PlayerStats | undefined => {
    return match?.player_stats?.find(stat => stat.playerId === playerId);
  };

  // Check if player is on field
  const isPlayerOnField = (player: Player): boolean => {
    return match?.lineup?.some(p => p.id === player.id) || false;
  };

  // Get all available players (lineup + reserves)
  const getAllPlayers = (): Player[] => {
    if (!match) return [];
    
    const lineup = Array.isArray(match.lineup) ? match.lineup : [];
    const reserves = Array.isArray(match.reserve_players) ? match.reserve_players : [];
    
    // Combine and deduplicate players
    const allPlayers = [...lineup, ...reserves];
    const uniquePlayers = allPlayers.filter((player, index, self) => 
      index === self.findIndex(p => p.id === player.id)
    );
    
    // Sort by name for consistent display
    return uniquePlayers.sort((a, b) => a.name.localeCompare(b.name));
  };

  if (loading) {
    return (
      <SafeAreaView style={matchStyles.container}>
        <View style={matchStyles.loadingContainer}>
          <Text style={matchStyles.loadingText}>Wedstrijd laden...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!match) {
    return (
      <SafeAreaView style={matchStyles.container}>
        <View style={matchStyles.loadingContainer}>
          <Text style={matchStyles.loadingText}>Wedstrijd niet gevonden</Text>
        </View>
      </SafeAreaView>
    );
  }

  const hasSubstitutionSchedule = match.substitution_schedule && 
    Object.keys(match.substitution_schedule).length > 0;

  const allPlayers = getAllPlayers();

  return (
    <SafeAreaView style={matchStyles.container}>
      {/* Header */}
      <View style={matchStyles.header}>
        <TouchableOpacity
          style={matchStyles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={20} color="#374151" />
        </TouchableOpacity>
        <View style={matchStyles.headerInfo}>
          <Text style={matchStyles.matchTitle}>
            {match.home_team} vs {match.away_team}
          </Text>
          <Text style={matchStyles.teamName}>{match.teams.name}</Text>
        </View>
        {hasSubstitutionSchedule && (
          <TouchableOpacity style={matchStyles.scheduleButton}>
            <Settings size={18} color="#FF6B35" />
          </TouchableOpacity>
        )}
      </View>

      {/* Time Display */}
      <TimeDisplay
        currentTime={currentTime}
        currentQuarter={currentQuarter}
        homeScore={homeScore}
        awayScore={awayScore}
        formatTime={formatTime}
      />

      {/* Substitution Banner */}
      <SubstitutionBanner
        isSubstituting={isSubstituting}
        selectedPosition={selectedPosition}
        selectedPlayer={selectedPlayer}
        getPositionName={getPositionName}
        onDismiss={dismissSubstitution}
      />

      {/* View Mode Toggle */}
      <ViewModeToggle
        hasSubstitutionSchedule={hasSubstitutionSchedule}
        viewMode={viewMode}
        setViewMode={setViewMode}
      />

      {/* Content */}
      <ScrollView
        style={matchStyles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Formation View */}
        {viewMode === 'formation' && (
          <View style={matchStyles.section}>
            {formations.length > 0 ? (
              <FieldView
                positions={formations}
                lineup={match.lineup}
                onPositionPress={(position) => {
                  setSelectedPosition(position.id);
                  setHighlightPosition(position.id);
                  setIsSubstituting(true);
                }}
                highlightPosition={highlightPosition}
              />
            ) : (
              <View style={matchStyles.emptyContainer}>
                <Text style={matchStyles.emptyTitle}>Geen formatie beschikbaar</Text>
                <Text style={matchStyles.emptySubtitle}>
                  Er is geen formatie ingesteld voor deze wedstrijd
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Player List View - Enhanced Single Column */}
        {viewMode === 'list' && (
          <View style={matchStyles.section}>
            <View style={matchStyles.sectionHeader}>
              <Users size={18} color="#16A34A" />
              <Text style={matchStyles.sectionTitle}>
                Alle Spelers ({allPlayers.length})
              </Text>
            </View>

            {allPlayers.length === 0 ? (
              <View style={matchStyles.emptyContainer}>
                <Users size={40} color="#9CA3AF" />
                <Text style={matchStyles.emptyTitle}>Geen spelers beschikbaar</Text>
                <Text style={matchStyles.emptySubtitle}>
                  Er zijn geen spelers toegewezen aan deze wedstrijd
                </Text>
              </View>
            ) : (
              <View style={matchStyles.compactPlayersList}>
                {allPlayers.map((player) => {
                  const playerStats = getPlayerStats(player.id);
                  const isOnField = isPlayerOnField(player);
                  const isSelected = selectedPlayer?.id === player.id;
                  
                  return (
                    <CompactPlayerCard
                      key={player.id}
                      player={player}
                      stats={playerStats}
                      isOnField={isOnField}
                      isSelected={isSelected}
                      isSubstituting={isSubstituting}
                      onPress={() => handlePlayerPress(player)}
                      formation={formations}
                    />
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* Timeline View */}
        {viewMode === 'timeline' && hasSubstitutionSchedule && (
          <SubstitutionScheduleDisplay
            substitutionSchedule={match.substitution_schedule}
            currentTime={currentTime}
            currentQuarter={currentQuarter}
          />
        )}

        {/* Grid View */}
        {viewMode === 'grid' && hasSubstitutionSchedule && (
          <View style={matchStyles.section}>
            <Text style={matchStyles.sectionTitle}>Grid View</Text>
            <Text style={matchStyles.emptyText}>Grid view implementation coming soon</Text>
          </View>
        )}

        {/* Match Events Logger */}
        <MatchEventLogger
          players={allPlayers}
          onAddEvent={async (event) => {
            try {
              await matchEventLogger.logEvent({
                match_id: match.id,
                ...event,
                match_time: currentTime,
                quarter: currentQuarter,
              });
            } catch (error) {
              console.error('Error adding match event:', error);
            }
          }}
          currentTime={currentTime}
          currentQuarter={currentQuarter}
        />
      </ScrollView>

      {/* Time Control */}
      <TimeControl
        currentTime={currentTime}
        isPlaying={isPlaying}
        setCurrentTime={setCurrentTime}
        setIsPlaying={setIsPlaying}
        home_score={homeScore}
        away_score={awayScore}
        onHomeScoreUp={() => handleScoreChange('home', 1)}
        onHomeScoreDown={() => handleScoreChange('home', -1)}
        onAwayScoreUp={() => handleScoreChange('away', 1)}
        onAwayScoreDown={() => handleScoreChange('away', -1)}
      />
    </SafeAreaView>
  );
}