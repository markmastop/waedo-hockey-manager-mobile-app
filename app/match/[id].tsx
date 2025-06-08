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
import { Player, Substitution } from '@/types/database';
import {
  Play,
  Pause,
  Square,
  SkipForward,
  ArrowLeft,
  Clock,
  Users,
  ArrowUpDown,
} from 'lucide-react-native';

interface Match {
  id: string;
  team_id: string;
  date: string;
  home_team: string;
  away_team: string;
  location: string;
  field: string;
  lineup: Player[];
  reserve_players: Player[];
  substitutions: Substitution[];
  match_time: number;
  current_quarter: number;
  status: 'upcoming' | 'inProgress' | 'paused' | 'completed';
  is_home: boolean;
  teams: {
    name: string;
  };
}

export default function LiveMatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [isSubstituting, setIsSubstituting] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

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
      
      // Ensure JSONB fields are properly initialized as arrays
      const matchData = {
        ...data,
        lineup: Array.isArray(data.lineup) ? data.lineup : [],
        reserve_players: Array.isArray(data.reserve_players) ? data.reserve_players : [],
        substitutions: Array.isArray(data.substitutions) ? data.substitutions : [],
      };
      
      setMatch(matchData);
    } catch (error) {
      console.error('Error fetching match:', error);
      Alert.alert('Error', 'Failed to load match data');
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
    if (match?.status === 'inProgress') {
      timerRef.current = setInterval(() => {
        setMatch(prev => {
          if (prev) {
            return { ...prev, match_time: prev.match_time + 1 };
          }
          return prev;
        });
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
  }, [match?.status]);

  const updateMatch = async (updates: Partial<Match>) => {
    if (!match) return;

    try {
      const { error } = await supabase
        .from('matches')
        .update(updates)
        .eq('id', match.id);

      if (error) throw error;
      setMatch(prev => prev ? { ...prev, ...updates } : null);
    } catch (error) {
      console.error('Error updating match:', error);
      Alert.alert('Error', 'Failed to update match');
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
      'End Match',
      'Are you sure you want to end this match?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Match',
          style: 'destructive',
          onPress: () => updateMatch({ status: 'completed' }),
        },
      ]
    );
  };

  const nextQuarter = () => {
    if (match && match.current_quarter < 4) {
      updateMatch({ current_quarter: match.current_quarter + 1 });
    }
  };

  const handlePlayerPress = (player: Player, isOnField: boolean) => {
    if (isSubstituting) {
      makeSubstitution(player, isOnField);
    } else {
      setSelectedPlayer(player);
      setIsSubstituting(true);
    }
  };

  const makeSubstitution = (targetPlayer: Player, targetIsOnField: boolean) => {
    if (!match || !selectedPlayer) return;

    const newLineup = [...match.lineup];
    const newReservePlayers = [...match.reserve_players];
    const selectedIsOnField = newLineup.some(p => p.id === selectedPlayer.id);

    if (selectedIsOnField && !targetIsOnField) {
      // Move selected from field to bench, target from bench to field
      const selectedIndex = newLineup.findIndex(p => p.id === selectedPlayer.id);
      const targetIndex = newReservePlayers.findIndex(p => p.id === targetPlayer.id);
      
      newLineup[selectedIndex] = targetPlayer;
      newReservePlayers[targetIndex] = selectedPlayer;
    } else if (!selectedIsOnField && targetIsOnField) {
      // Move selected from bench to field, target from field to bench
      const selectedIndex = newReservePlayers.findIndex(p => p.id === selectedPlayer.id);
      const targetIndex = newLineup.findIndex(p => p.id === targetPlayer.id);
      
      newReservePlayers[selectedIndex] = targetPlayer;
      newLineup[targetIndex] = selectedPlayer;
    }

    const substitution: Substitution = {
      time: match.match_time,
      quarter: match.current_quarter,
      playerIn: selectedIsOnField ? targetPlayer : selectedPlayer,
      playerOut: selectedIsOnField ? selectedPlayer : targetPlayer,
      timestamp: new Date().toISOString(),
    };

    const newSubstitutions = [...match.substitutions, substitution];

    updateMatch({
      lineup: newLineup,
      reserve_players: newReservePlayers,
      substitutions: newSubstitutions,
    });

    setSelectedPlayer(null);
    setIsSubstituting(false);
  };

  const cancelSubstitution = () => {
    setSelectedPlayer(null);
    setIsSubstituting(false);
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
          <Text style={styles.loadingText}>Loading match...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!match) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Match not found</Text>
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
          <ArrowLeft size={24} color="#374151" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.matchTitle}>
            {match.home_team} vs {match.away_team}
          </Text>
          <Text style={styles.teamName}>{match.teams.name}</Text>
        </View>
      </View>

      <View style={styles.matchStatus}>
        <View style={styles.timeDisplay}>
          <Clock size={20} color="#374151" />
          <Text style={styles.timeText}>{formatTime(match.match_time)}</Text>
          <Text style={styles.quarterText}>Q{match.current_quarter}</Text>
        </View>
        <View style={styles.statusBadge}>
          <Text
            style={[
              styles.statusText,
              { color: match.status === 'inProgress' ? '#059669' : '#EA580C' },
            ]}
          >
            {match.status === 'inProgress' ? 'LIVE' : match.status.toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.matchControls}>
        {match.status === 'upcoming' && (
          <TouchableOpacity style={styles.startButton} onPress={startMatch}>
            <Play size={16} color="#FFFFFF" />
            <Text style={styles.startButtonText}>Start Match</Text>
          </TouchableOpacity>
        )}
        
        {match.status === 'inProgress' && (
          <>
            <TouchableOpacity style={styles.controlButton} onPress={pauseMatch}>
              <Pause size={16} color="#374151" />
              <Text style={styles.controlButtonText}>Pause</Text>
            </TouchableOpacity>
            {match.current_quarter < 4 && (
              <TouchableOpacity style={styles.controlButton} onPress={nextQuarter}>
                <SkipForward size={16} color="#374151" />
                <Text style={styles.controlButtonText}>Next Quarter</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.endButton} onPress={endMatch}>
              <Square size={16} color="#FFFFFF" />
              <Text style={styles.endButtonText}>End</Text>
            </TouchableOpacity>
          </>
        )}
        
        {match.status === 'paused' && (
          <>
            <TouchableOpacity style={styles.startButton} onPress={resumeMatch}>
              <Play size={16} color="#FFFFFF" />
              <Text style={styles.startButtonText}>Resume</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.endButton} onPress={endMatch}>
              <Square size={16} color="#FFFFFF" />
              <Text style={styles.endButtonText}>End</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {isSubstituting && (
        <View style={styles.substitutionBanner}>
          <ArrowUpDown size={16} color="#16A34A" />
          <Text style={styles.substitutionText}>
            Select a player to substitute with {selectedPlayer?.name}
          </Text>
          <TouchableOpacity onPress={cancelSubstitution}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Users size={20} color="#059669" />
            <Text style={styles.sectionTitle}>On Field ({match.lineup.length})</Text>
          </View>
          <View style={styles.playersList}>
            {match.lineup.map((player) => (
              <TouchableOpacity
                key={player.id}
                style={[
                  styles.playerCard,
                  styles.onFieldCard,
                  selectedPlayer?.id === player.id && styles.selectedCard,
                ]}
                onPress={() => handlePlayerPress(player, true)}
              >
                <View style={styles.playerNumber}>
                  <Text style={styles.playerNumberText}>#{player.number}</Text>
                </View>
                <View style={styles.playerInfo}>
                  <Text style={styles.playerName}>{player.name}</Text>
                  <Text style={styles.playerPosition}>{player.position}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Users size={20} color="#6B7280" />
            <Text style={styles.sectionTitle}>Bench ({match.reserve_players.length})</Text>
          </View>
          <View style={styles.playersList}>
            {match.reserve_players.map((player) => (
              <TouchableOpacity
                key={player.id}
                style={[
                  styles.playerCard,
                  styles.benchCard,
                  selectedPlayer?.id === player.id && styles.selectedCard,
                ]}
                onPress={() => handlePlayerPress(player, false)}
              >
                <View style={styles.playerNumber}>
                  <Text style={styles.playerNumberText}>#{player.number}</Text>
                </View>
                <View style={styles.playerInfo}>
                  <Text style={styles.playerName}>{player.name}</Text>
                  <Text style={styles.playerPosition}>{player.position}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
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
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    marginRight: 16,
  },
  headerInfo: {
    flex: 1,
  },
  matchTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  teamName: {
    fontSize: 14,
    color: '#6B7280',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    color: '#6B7280',
    fontWeight: '500',
  },
  matchStatus: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  timeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  quarterText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  matchControls: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 12,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#059669',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  startButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  controlButtonText: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 14,
  },
  endButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DC2626',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  endButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
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
    fontSize: 14,
    color: '#16A34A',
    fontWeight: '500',
  },
  cancelText: {
    fontSize: 14,
    color: '#DC2626',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  playersList: {
    gap: 8,
  },
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  onFieldCard: {
    backgroundColor: '#ECFDF5',
  },
  benchCard: {
    backgroundColor: '#F9FAFB',
  },
  selectedCard: {
    borderColor: '#16A34A',
    backgroundColor: '#F0FDF4',
  },
  playerNumber: {
    width: 40,
    height: 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  playerNumberText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#16A34A',
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  playerPosition: {
    fontSize: 14,
    color: '#6B7280',
  },
});