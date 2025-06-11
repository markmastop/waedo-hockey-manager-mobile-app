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
import { Match } from '@/types/match';
import { PlayerCard } from '@/components/PlayerCard';
import { getPositionColor, getPositionDisplayName } from '@/lib/playerPositions';
import {
  Play,
  Pause,
  Square,
  SkipForward,
  ArrowLeft,
  Clock,
  Users,
  ArrowUpDown,
  Star,
} from 'lucide-react-native';


export default function LiveMatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [isSubstituting, setIsSubstituting] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const convertPlayersDataToArray = (playersData: any): Player[] => {
    console.log('Converting players data:', playersData);
    
    if (!playersData) {
      console.log('No players data provided');
      return [];
    }
    
    // If it's already an array, filter and return it
    if (Array.isArray(playersData)) {
      console.log('Players data is array with length:', playersData.length);
      const filteredPlayers = playersData.filter(player => 
        player && 
        typeof player === 'object' && 
        player.id && 
        player.name
      );
      console.log('Filtered players:', filteredPlayers);
      return filteredPlayers;
    }
    
    // If it's an object with position keys, convert to array
    if (typeof playersData === 'object') {
      console.log('Players data is object with keys:', Object.keys(playersData));
      const players: Player[] = [];
      
      // Extract players from each position
      Object.keys(playersData).forEach(position => {
        const playerData = playersData[position];
        console.log(`Processing position ${position}:`, playerData);
        
        if (playerData && typeof playerData === 'object') {
          // Ensure the player has required fields
          if (playerData.id && playerData.name) {
            const player = {
              id: playerData.id,
              name: playerData.name,
              number: playerData.number || 0,
              position: playerData.position || position,
            };
            console.log('Adding player:', player);
            players.push(player);
          } else {
            console.log('Skipping invalid player data:', playerData);
          }
        }
      });
      
      console.log('Final converted players array:', players);
      return players;
    }
    
    console.log('Unknown players data format');
    return [];
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
      
      console.log('Raw match data:', data);
      console.log('Lineup data:', data.lineup);
      console.log('Reserve players data:', data.reserve_players);
      console.log('Reserve players type:', typeof data.reserve_players);
      console.log('Reserve players is array:', Array.isArray(data.reserve_players));
      
      // Convert both lineup and reserve_players to arrays
      const lineupArray = convertPlayersDataToArray(data.lineup);
      const reservePlayersArray = convertPlayersDataToArray(data.reserve_players);
      const substitutionsArray = Array.isArray(data.substitutions) ? data.substitutions : [];
      
      const matchData = {
        ...data,
        lineup: lineupArray,
        reserve_players: reservePlayersArray,
        substitutions: substitutionsArray,
      };
      
      console.log('Processed match data:', matchData);
      console.log('Final lineup:', matchData.lineup);
      console.log('Final reserve players:', matchData.reserve_players);
      
      setMatch(matchData);
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
      console.log('Updating match with:', updates);
      
      // Prepare the updates for the database
      const dbUpdates: any = {};
      
      // Convert arrays back to the format expected by the database if needed
      Object.keys(updates).forEach(key => {
        if (key === 'lineup' || key === 'reserve_players') {
          // Keep as arrays since the database expects JSONB arrays
          dbUpdates[key] = updates[key as keyof Match];
          console.log(`Database update for ${key}:`, dbUpdates[key]);
        } else {
          dbUpdates[key] = updates[key as keyof Match];
        }
      });

      const { error } = await supabase
        .from('matches')
        .update(dbUpdates)
        .eq('id', match.id);

      if (error) throw error;
      
      console.log('Match updated successfully');
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

  const nextQuarter = () => {
    if (match && match.current_quarter < 4) {
      updateMatch({ current_quarter: match.current_quarter + 1 });
    }
  };

  const handlePlayerPress = (player: Player, isOnField: boolean) => {
    console.log('Player pressed:', player.name, 'isOnField:', isOnField);
    
    if (isSubstituting) {
      makeSubstitution(player, isOnField);
    } else {
      setSelectedPlayer(player);
      setIsSubstituting(true);
    }
  };

  const makeSubstitution = (targetPlayer: Player, targetIsOnField: boolean) => {
    if (!match || !selectedPlayer) return;

    console.log('Making substitution:', {
      selected: selectedPlayer.name,
      target: targetPlayer.name,
      targetIsOnField
    });

    const newLineup = [...match.lineup];
    const newReservePlayers = [...match.reserve_players];
    const selectedIsOnField = newLineup.some(p => p.id === selectedPlayer.id);

    console.log('Current lineup:', newLineup.map(p => p.name));
    console.log('Current reserves:', newReservePlayers.map(p => p.name));
    console.log('Selected is on field:', selectedIsOnField);

    if (selectedIsOnField && !targetIsOnField) {
      // Move selected from field to bench, target from bench to field
      const selectedIndex = newLineup.findIndex(p => p.id === selectedPlayer.id);
      const targetIndex = newReservePlayers.findIndex(p => p.id === targetPlayer.id);
      
      console.log('Swapping field->bench:', { selectedIndex, targetIndex });
      
      if (selectedIndex !== -1 && targetIndex !== -1) {
        newLineup[selectedIndex] = targetPlayer;
        newReservePlayers[targetIndex] = selectedPlayer;
      }
    } else if (!selectedIsOnField && targetIsOnField) {
      // Move selected from bench to field, target from field to bench
      const selectedIndex = newReservePlayers.findIndex(p => p.id === selectedPlayer.id);
      const targetIndex = newLineup.findIndex(p => p.id === targetPlayer.id);
      
      console.log('Swapping bench->field:', { selectedIndex, targetIndex });
      
      if (selectedIndex !== -1 && targetIndex !== -1) {
        newReservePlayers[selectedIndex] = targetPlayer;
        newLineup[targetIndex] = selectedPlayer;
      }
    }

    const substitution: Substitution = {
      time: match.match_time,
      quarter: match.current_quarter,
      playerIn: selectedIsOnField ? targetPlayer : selectedPlayer,
      playerOut: selectedIsOnField ? selectedPlayer : targetPlayer,
      timestamp: new Date().toISOString(),
    };

    const newSubstitutions = [...match.substitutions, substitution];

    console.log('New lineup:', newLineup.map(p => p.name));
    console.log('New reserves:', newReservePlayers.map(p => p.name));

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
      </View>

      <View style={styles.matchStatus}>
        <View style={styles.timeDisplay}>
          <Clock size={18} color="#374151" />
          <Text style={styles.timeText}>{formatTime(match.match_time)}</Text>
          <Text style={styles.quarterText}>K{match.current_quarter}</Text>
        </View>
        <View style={styles.statusBadge}>
          <Text
            style={[
              styles.statusText,
              { color: match.status === 'inProgress' ? '#059669' : '#EA580C' },
            ]}
          >
            {match.status === 'inProgress' ? 'LIVE' : 
             match.status === 'paused' ? 'GEPAUZEERD' :
             match.status === 'upcoming' ? 'AANKOMEND' :
             match.status.toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.matchControls}>
        {match.status === 'upcoming' && (
          <TouchableOpacity style={styles.startButton} onPress={startMatch}>
            <Play size={14} color="#FFFFFF" />
            <Text style={styles.startButtonText}>Start Wedstrijd</Text>
          </TouchableOpacity>
        )}
        
        {match.status === 'inProgress' && (
          <>
            <TouchableOpacity style={styles.controlButton} onPress={pauseMatch}>
              <Pause size={14} color="#374151" />
              <Text style={styles.controlButtonText}>Pauzeren</Text>
            </TouchableOpacity>
            {match.current_quarter < 4 && (
              <TouchableOpacity style={styles.controlButton} onPress={nextQuarter}>
                <SkipForward size={14} color="#374151" />
                <Text style={styles.controlButtonText}>Volgend Kwart</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.endButton} onPress={endMatch}>
              <Square size={14} color="#FFFFFF" />
              <Text style={styles.endButtonText}>Beëindigen</Text>
            </TouchableOpacity>
          </>
        )}
        
        {match.status === 'paused' && (
          <>
            <TouchableOpacity style={styles.startButton} onPress={resumeMatch}>
              <Play size={14} color="#FFFFFF" />
              <Text style={styles.startButtonText}>Hervatten</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.endButton} onPress={endMatch}>
              <Square size={14} color="#FFFFFF" />
              <Text style={styles.endButtonText}>Beëindigen</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {isSubstituting && (
        <View style={styles.substitutionBanner}>
          <ArrowUpDown size={14} color="#16A34A" />
          <Text style={styles.substitutionText}>
            Selecteer een speler om te wisselen met {selectedPlayer?.name}
          </Text>
          <TouchableOpacity onPress={cancelSubstitution}>
            <Text style={styles.cancelText}>Annuleren</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Star size={18} color="#16A34A" />
            <Text style={styles.sectionTitle}>Basisopstelling ({match.lineup.length})</Text>
          </View>
          {match.lineup.length === 0 ? (
            <View style={styles.emptyLineupContainer}>
              <Users size={40} color="#9CA3AF" />
              <Text style={styles.emptyTitle}>Geen basisopstelling ingesteld</Text>
              <Text style={styles.emptySubtitle}>
                De basisopstelling is nog niet geconfigureerd voor deze wedstrijd
              </Text>
            </View>
          ) : (
            <View style={styles.playersList}>
              {match.lineup.map((player) => (
                <PlayerCard
                  key={player.id}
                  player={player}
                  showStar
                  selected={selectedPlayer?.id === player.id}
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
              <Text style={styles.emptySubtext}>
                Er zijn momenteel geen reservespelers ingesteld voor deze wedstrijd
              </Text>
            </View>
          ) : (
            <View style={styles.playersList}>
              {match.reserve_players.map((player) => (
                <PlayerCard
                  key={player.id}
                  player={player}
                  selected={selectedPlayer?.id === player.id}
                  onPress={() => handlePlayerPress(player, false)}
                />
              ))}
            </View>
          )}
        </View>

        {match.substitutions.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <ArrowUpDown size={18} color="#EA580C" />
              <Text style={styles.sectionTitle}>Wissels ({match.substitutions.length})</Text>
            </View>
            <View style={styles.substitutionsList}>
              {match.substitutions.map((sub, index) => (
                <View key={index} style={styles.substitutionCard}>
                  <View style={styles.substitutionTime}>
                    <Text style={styles.substitutionTimeText}>
                      {formatTime(sub.time)} - K{sub.quarter}
                    </Text>
                  </View>
                  <View style={styles.substitutionDetails}>
                    <Text style={styles.substitutionText}>
                      <Text style={styles.playerOut}>
                        #{sub.playerOut.number || '?'} {sub.playerOut.name}
                      </Text>
                      {' → '}
                      <Text style={styles.playerIn}>
                        #{sub.playerIn.number || '?'} {sub.playerIn.name}
                      </Text>
                    </Text>
                  </View>
                </View>
              ))}
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
    fontWeight: 'bold',
    color: '#111827',
  },
  teamName: {
    fontSize: 12,
    color: '#6B7280',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  matchStatus: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  timeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  quarterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  statusBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  matchControls: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 8,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#059669',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 4,
  },
  startButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 4,
  },
  controlButtonText: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 12,
  },
  endButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DC2626',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 4,
  },
  endButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
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
    fontWeight: '500',
  },
  cancelText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
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
    fontWeight: 'bold',
    color: '#111827',
  },
  emptyLineupContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginTop: 12,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 6,
    fontWeight: '500',
  },
  emptySubtext: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 3,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  playersList: {
    gap: 6,
  },
  substitutionsList: {
    gap: 6,
  },
  substitutionCard: {
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderLeftWidth: 3,
    borderLeftColor: '#EA580C',
  },
  substitutionTime: {
    marginBottom: 3,
  },
  substitutionTimeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6B7280',
  },
  substitutionDetails: {},
  substitutionText: {
    fontSize: 12,
    color: '#374151',
  },
  playerOut: {
    color: '#DC2626',
    fontWeight: '500',
  },
  playerIn: {
    color: '#16A34A',
    fontWeight: '500',
  },
});