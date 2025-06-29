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
import { ArrowLeft, Calendar, Settings, Users, Eye, Clock, Grid3X3 } from 'lucide-react-native';
import { styles } from '@/app/styles/match';
import FieldView from '@/components/FieldView';
import { CompactPlayerCard } from '@/components/CompactPlayerCard';
import { LiveMatchTimer } from '@/components/LiveMatchTimer';
import { MatchEventLogger } from '@/components/MatchEventLogger';
import { SubstitutionScheduleDisplay } from '@/components/SubstitutionScheduleDisplay';
import { matchEventLogger } from '@/lib/matchEventLogger';
import PlayerSelectionBanner from '@/components/PlayerSelectionBanner';

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
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null);
  const [isSubstituting, setIsSubstituting] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [swapFromPlayer, setSwapFromPlayer] = useState<Player | null>(null);
  const [swapFromPosition, setSwapFromPosition] = useState<string | null>(null);

  // Live match state
  const [matchTime, setMatchTime] = useState(0);
  const [currentQuarter, setCurrentQuarter] = useState(1);
  const [quarterTimes, setQuarterTimes] = useState([0, 0, 0, 0]);
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [matchStatus, setMatchStatus] = useState<'upcoming' | 'inProgress' | 'paused' | 'completed'>('upcoming');

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

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

      const matchData = {
        ...data,
        lineup: convertPlayersDataToArray(data.lineup),
        reserve_players: convertPlayersDataToArray(data.reserve_players),
        home_score: data.home_score || 0,
        away_score: data.away_score || 0,
      };

      setMatch(matchData);
      setMatchTime(matchData.match_time || 0);
      setCurrentQuarter(matchData.current_quarter || 1);
      setQuarterTimes(matchData.quarter_times || [0, 0, 0, 0]);
      setHomeScore(matchData.home_score || 0);
      setAwayScore(matchData.away_score || 0);
      setMatchStatus(matchData.status || 'upcoming');

      // Fetch formation if available
      if (matchData.formation_key || matchData.formation) {
        await fetchFormation(matchData.formation_key || matchData.formation);
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
      const { data, error } = await supabase
        .from('formations')
        .select('positions')
        .eq('key', formationKey)
        .single();

      if (error) throw error;

      if (data?.positions && Array.isArray(data.positions)) {
        setFormation(data.positions);
      }
    } catch (error) {
      console.error('Error fetching formation:', error);
    }
  };

  useEffect(() => {
    if (id) {
      fetchMatch();
    }
  }, [id]);

  useEffect(() => {
    if (matchStatus === 'inProgress') {
      intervalRef.current = setInterval(() => {
        setMatchTime(prev => {
          const newTime = prev + 1;
          // Log time updates periodically (every 30 seconds)
          if (newTime % 30 === 0 && match?.id) {
            matchEventLogger.updateMatchTime(match.id, newTime, currentQuarter);
          }
          return newTime;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [matchStatus, currentQuarter, match?.id]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchMatch();
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handlePlayerPress = (player: Player, isOnField: boolean) => {
    if (isSubstituting) {
      if (selectedPosition && !isOnField) {
        // Substitute player into selected position
        handleSubstitution(player, selectedPosition);
      } else if (selectedPlayer && isOnField) {
        // Substitute selected player out for this player
        handleSubstitution(player, selectedPlayer.position);
      }
    } else if (isSwapping) {
      if (swapFromPlayer && player.id !== swapFromPlayer.id) {
        handlePlayerSwap(swapFromPlayer, player);
      }
    } else {
      // Regular selection
      setSelectedPlayer(player);
      
      // Log player selection
      if (match?.id) {
        matchEventLogger.logPlayerSelection(
          match.id,
          player,
          matchTime,
          currentQuarter,
          isOnField ? 'field' : 'bench'
        );
      }
    }
  };

  const handlePositionPress = (position: FormationPosition) => {
    if (selectedPlayer) {
      // Move selected player to this position
      handlePlayerPositionChange(selectedPlayer, position);
    } else {
      setSelectedPosition(position.id);
      setIsSubstituting(true);
    }
  };

  const handlePlayerPositionChange = (player: Player, position: FormationPosition) => {
    if (!match) return;

    const updatedLineup = [...match.lineup];
    const playerIndex = updatedLineup.findIndex(p => p.id === player.id);
    
    if (playerIndex !== -1) {
      updatedLineup[playerIndex] = {
        ...player,
        position: position.dutch_name || position.name
      };
      
      setMatch({
        ...match,
        lineup: updatedLineup
      });
    }

    setSelectedPlayer(null);
    setSelectedPosition(null);
  };

  const handleSubstitution = (playerIn: Player, position: string) => {
    if (!match) return;

    const playerOut = match.lineup.find(p => p.position === position);
    if (!playerOut) return;

    // Update lineup and reserves
    const updatedLineup = match.lineup.map(p => 
      p.position === position ? { ...playerIn, position } : p
    );
    
    const updatedReserves = [
      ...match.reserve_players.filter(p => p.id !== playerIn.id),
      playerOut
    ];

    setMatch({
      ...match,
      lineup: updatedLineup,
      reserve_players: updatedReserves
    });

    // Log substitution
    if (match.id) {
      matchEventLogger.logSubstitution(
        match.id,
        playerIn,
        playerOut,
        position,
        matchTime,
        currentQuarter
      );
    }

    setIsSubstituting(false);
    setSelectedPlayer(null);
    setSelectedPosition(null);
  };

  const handlePlayerSwap = (player1: Player, player2: Player) => {
    if (!match) return;

    const updatedLineup = [...match.lineup];
    const updatedReserves = [...match.reserve_players];

    const player1InLineup = updatedLineup.findIndex(p => p.id === player1.id);
    const player2InLineup = updatedLineup.findIndex(p => p.id === player2.id);
    const player1InReserves = updatedReserves.findIndex(p => p.id === player1.id);
    const player2InReserves = updatedReserves.findIndex(p => p.id === player2.id);

    // Handle different swap scenarios
    if (player1InLineup !== -1 && player2InLineup !== -1) {
      // Both in lineup - swap positions
      const temp = updatedLineup[player1InLineup].position;
      updatedLineup[player1InLineup].position = updatedLineup[player2InLineup].position;
      updatedLineup[player2InLineup].position = temp;
    } else if (player1InLineup !== -1 && player2InReserves !== -1) {
      // Player1 in lineup, Player2 in reserves
      updatedReserves[player2InReserves] = updatedLineup[player1InLineup];
      updatedLineup[player1InLineup] = { ...player2, position: player1.position };
      updatedReserves.splice(player2InReserves, 1);
    } else if (player1InReserves !== -1 && player2InLineup !== -1) {
      // Player1 in reserves, Player2 in lineup
      updatedReserves[player1InReserves] = updatedLineup[player2InLineup];
      updatedLineup[player2InLineup] = { ...player1, position: player2.position };
      updatedReserves.splice(player1InReserves, 1);
    }

    setMatch({
      ...match,
      lineup: updatedLineup,
      reserve_players: updatedReserves
    });

    // Log player swap
    if (match.id) {
      matchEventLogger.logPlayerSwap(
        match.id,
        player1,
        player2,
        matchTime,
        currentQuarter,
        player1.position,
        player2.position
      );
    }

    setIsSwapping(false);
    setSwapFromPlayer(null);
    setSwapFromPosition(null);
  };

  const handleMatchStart = () => {
    if (!match?.id) return;
    
    setMatchStatus('inProgress');
    matchEventLogger.logMatchStart(match.id);
  };

  const handleMatchPause = () => {
    if (!match?.id) return;
    
    setMatchStatus('paused');
    matchEventLogger.updateMatchStatus(match.id, 'paused', matchTime, currentQuarter);
  };

  const handleMatchResume = () => {
    if (!match?.id) return;
    
    setMatchStatus('inProgress');
    matchEventLogger.updateMatchStatus(match.id, 'inProgress', matchTime, currentQuarter);
  };

  const handleMatchEnd = () => {
    if (!match?.id) return;
    
    setMatchStatus('completed');
    matchEventLogger.logMatchEnd(match.id, matchTime, currentQuarter, {
      home: homeScore,
      away: awayScore
    });
  };

  const handleNextQuarter = () => {
    if (currentQuarter < 4) {
      const newQuarter = currentQuarter + 1;
      setCurrentQuarter(newQuarter);
      
      if (match?.id) {
        matchEventLogger.logQuarterEnd(match.id, currentQuarter, matchTime);
        matchEventLogger.logQuarterStart(match.id, newQuarter, matchTime);
      }
    }
  };

  const handleTimeUpdate = (time: number) => {
    setMatchTime(time);
  };

  const handleScoreUpdate = (newHomeScore: number, newAwayScore: number) => {
    const previousHomeScore = homeScore;
    const previousAwayScore = awayScore;
    
    setHomeScore(newHomeScore);
    setAwayScore(newAwayScore);

    // Log score change
    if (match?.id) {
      let teamScored: 'home' | 'away' | undefined;
      if (newHomeScore > previousHomeScore) teamScored = 'home';
      else if (newAwayScore > previousAwayScore) teamScored = 'away';

      matchEventLogger.logScoreChange(
        match.id,
        matchTime,
        currentQuarter,
        newHomeScore,
        newAwayScore,
        previousHomeScore,
        previousAwayScore,
        teamScored
      );
    }
  };

  const handleAddEvent = (event: any) => {
    if (!match?.id) return;
    
    // Handle different event types
    switch (event.type) {
      case 'goal':
        if (event.player) {
          matchEventLogger.logGoal(match.id, event.player, matchTime, currentQuarter);
        }
        break;
      case 'card':
        if (event.player) {
          matchEventLogger.logCard(match.id, event.player, 'yellow', matchTime, currentQuarter, event.details);
        }
        break;
      case 'timeout':
        matchEventLogger.logTimeout(match.id, matchTime, currentQuarter, 'home');
        break;
      case 'injury':
        if (event.player) {
          matchEventLogger.logInjury(match.id, event.player, matchTime, currentQuarter);
        }
        break;
      case 'penalty_corner':
        matchEventLogger.logPenaltyCorner(match.id, matchTime, currentQuarter, 'home');
        break;
      case 'penalty_stroke':
        if (event.player) {
          matchEventLogger.logPenaltyStroke(match.id, event.player, matchTime, currentQuarter, 'goal');
        }
        break;
    }
  };

  const dismissSelection = () => {
    setSelectedPlayer(null);
    setSelectedPosition(null);
    setIsSubstituting(false);
    setIsSwapping(false);
    setSwapFromPlayer(null);
    setSwapFromPosition(null);
  };

  const handleGoalAction = () => {
    if (!selectedPlayer || !match?.id) return;
    
    matchEventLogger.logGoal(match.id, selectedPlayer, matchTime, currentQuarter);
    dismissSelection();
  };

  const handleSubstituteAction = () => {
    if (!selectedPlayer) return;
    
    setIsSubstituting(true);
    // Keep the selected player for substitution
  };

  const getPositionName = (position: string) => {
    const formationPosition = formation.find(pos => 
      pos.id === position || 
      pos.name === position || 
      pos.dutch_name === position
    );
    return formationPosition?.dutch_name || formationPosition?.name || position;
  };

  const hasSubstitutionSchedule = match?.substitution_schedule && 
    Object.keys(match.substitution_schedule).length > 0;

  const allPlayers = match ? [...match.lineup, ...match.reserve_players] : [];

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
        <TouchableOpacity style={styles.scheduleButton}>
          <Settings size={16} color="#FF6B35" />
        </TouchableOpacity>
      </View>

      {/* Player Selection Banner */}
      <PlayerSelectionBanner
        selectedPlayer={selectedPlayer}
        onGoal={handleGoalAction}
        onSubstitute={handleSubstituteAction}
        onDismiss={dismissSelection}
      />

      {/* Substitution Banner */}
      {isSubstituting && (
        <View style={styles.substitutionBanner}>
          <Text style={styles.substitutionText}>
            {selectedPlayer && selectedPosition
              ? `Wissel ${selectedPlayer.name} (#${selectedPlayer.number}) uit positie ${getPositionName(selectedPosition)}`
              : selectedPosition
              ? `Selecteer een speler voor positie ${getPositionName(selectedPosition)}`
              : selectedPlayer
              ? `Selecteer een positie voor ${selectedPlayer.name} (#${selectedPlayer.number})`
              : 'Selecteer een positie of speler om te wisselen'
            }
          </Text>
          <TouchableOpacity onPress={dismissSelection}>
            <Text style={styles.cancelText}>Annuleren</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Swap Banner */}
      {isSwapping && (
        <View style={styles.swapBanner}>
          <Text style={styles.swapText}>
            {swapFromPlayer
              ? `Selecteer een speler om te wisselen met ${swapFromPlayer.name} (#${swapFromPlayer.number})`
              : 'Selecteer een speler om te wisselen'
            }
          </Text>
          <TouchableOpacity onPress={dismissSelection}>
            <Text style={styles.cancelText}>Annuleren</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Live Match Timer */}
      <LiveMatchTimer
        matchTime={matchTime}
        currentQuarter={currentQuarter}
        quarterTimes={quarterTimes}
        status={matchStatus}
        homeScore={homeScore}
        awayScore={awayScore}
        homeTeam={match.home_team}
        awayTeam={match.away_team}
        onStart={handleMatchStart}
        onPause={handleMatchPause}
        onResume={handleMatchResume}
        onEnd={handleMatchEnd}
        onNextQuarter={handleNextQuarter}
        onTimeUpdate={handleTimeUpdate}
        onScoreUpdate={handleScoreUpdate}
      />

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
            Spelers
          </Text>
        </TouchableOpacity>

        {hasSubstitutionSchedule && (
          <TouchableOpacity
            style={[styles.viewModeButton, viewMode === 'grid' && styles.activeViewMode]}
            onPress={() => setViewMode('grid')}
          >
            <Grid3X3 size={16} color={viewMode === 'grid' ? '#FFFFFF' : '#6B7280'} />
            <Text style={[styles.viewModeText, viewMode === 'grid' && styles.activeViewModeText]}>
              Grid
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Formation View */}
        {viewMode === 'formation' && (
          <View style={styles.section}>
            {formation.length > 0 ? (
              <FieldView
                positions={formation}
                lineup={match.lineup}
                onPositionPress={handlePositionPress}
                highlightPosition={selectedPosition}
              />
            ) : (
              <View style={styles.emptyContainer}>
                <Eye size={40} color="#9CA3AF" />
                <Text style={styles.emptyTitle}>Geen formatie beschikbaar</Text>
                <Text style={styles.emptySubtitle}>
                  Er is geen formatie ingesteld voor deze wedstrijd
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Timeline View */}
        {viewMode === 'timeline' && hasSubstitutionSchedule && (
          <View style={styles.timelineContainer}>
            <SubstitutionScheduleDisplay
              substitutionSchedule={match.substitution_schedule}
              currentTime={matchTime}
              currentQuarter={currentQuarter}
            />
          </View>
        )}

        {/* List View */}
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
                  {match.lineup.map((player) => (
                    <CompactPlayerCard
                      key={player.id}
                      player={player}
                      isOnField={true}
                      isSelected={selectedPlayer?.id === player.id}
                      onPress={() => handlePlayerPress(player, true)}
                      formation={formation}
                    />
                  ))}
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
                  {match.reserve_players.map((player) => (
                    <CompactPlayerCard
                      key={player.id}
                      player={player}
                      isOnField={false}
                      isSelected={selectedPlayer?.id === player.id}
                      onPress={() => handlePlayerPress(player, false)}
                      formation={formation}
                    />
                  ))}
                </View>
              )}
            </View>
          </View>
        )}

        {/* Grid View */}
        {viewMode === 'grid' && hasSubstitutionSchedule && (
          <View style={styles.gridContainer}>
            <Text style={styles.emptyTitle}>Grid View</Text>
            <Text style={styles.emptySubtitle}>
              Grid view implementation coming soon
            </Text>
          </View>
        )}

        {/* Match Event Logger */}
        <MatchEventLogger
          players={allPlayers}
          onAddEvent={handleAddEvent}
          currentTime={matchTime}
          currentQuarter={currentQuarter}
        />
      </ScrollView>
    </SafeAreaView>
  );
}