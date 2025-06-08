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
  Star,
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

  const getPositionColor = (position: string) => {
    const safePosition = position?.toLowerCase() || '';
    switch (safePosition) {
      case 'goalkeeper':
      case 'gk':
      case 'keeper':
        return '#DC2626';
      case 'defender':
      case 'def':
      case 'verdediger':
      case 'sweeper':
      case 'lastline':
      case 'leftback':
      case 'rightback':
        return '#1E40AF';
      case 'midfielder':
      case 'mid':
      case 'middenvelder':
      case 'leftmidfield':
      case 'rightmidfield':
      case 'centermidfield':
        return '#7C3AED';
      case 'forward':
      case 'fwd':
      case 'aanvaller':
      case 'striker':
      case 'leftforward':
      case 'rightforward':
        return '#EA580C';
      default:
        return '#6B7280';
    }
  };

  const getPositionDisplayName = (position: string) => {
    const safePosition = position?.toLowerCase() || '';
    switch (safePosition) {
      case 'striker':
        return 'Aanvaller';
      case 'sweeper':
        return 'Libero';
      case 'lastline':
        return 'Laatste Lijn';
      case 'leftback':
        return 'Linksback';
      case 'rightback':
        return 'Rechtsback';
      case 'leftmidfield':
        return 'Linksmidden';
      case 'rightmidfield':
        return 'Rechtsmidden';
      case 'centermidfield':
        return 'Middenmidden';
      case 'leftforward':
        return 'Linksvoorwaarts';
      case 'rightforward':
        return 'Rechtsvoorwaarts';
      case 'goalkeeper':
      case 'gk':
      case 'keeper':
        return 'Keeper';
      case 'defender':
      case 'def':
      case 'verdediger':
        return 'Verdediger';
      case 'midfielder':
      case 'mid':
      case 'middenvelder':
        return 'Middenvelder';
      case 'forward':
      case 'fwd':
      case 'aanvaller':
        return 'Aanvaller';
      default:
        return position || 'Onbekend';
    }
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
            <Play size={16} color="#FFFFFF" />
            <Text style={styles.startButtonText}>Start Wedstrijd</Text>
          </TouchableOpacity>
        )}
        
        {match.status === 'inProgress' && (
          <>
            <TouchableOpacity style={styles.controlButton} onPress={pauseMatch}>
              <Pause size={16} color="#374151" />
              <Text style={styles.controlButtonText}>Pauzeren</Text>
            </TouchableOpacity>
            {match.current_quarter < 4 && (
              <TouchableOpacity style={styles.controlButton} onPress={nextQuarter}>
                <SkipForward size={16} color="#374151" />
                <Text style={styles.controlButtonText}>Volgend Kwart</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.endButton} onPress={endMatch}>
              <Square size={16} color="#FFFFFF" />
              <Text style={styles.endButtonText}>Beëindigen</Text>
            </TouchableOpacity>
          </>
        )}
        
        {match.status === 'paused' && (
          <>
            <TouchableOpacity style={styles.startButton} onPress={resumeMatch}>
              <Play size={16} color="#FFFFFF" />
              <Text style={styles.startButtonText}>Hervatten</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.endButton} onPress={endMatch}>
              <Square size={16} color="#FFFFFF" />
              <Text style={styles.endButtonText}>Beëindigen</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {isSubstituting && (
        <View style={styles.substitutionBanner}>
          <ArrowUpDown size={16} color="#16A34A" />
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
            <Star size={20} color="#16A34A" />
            <Text style={styles.sectionTitle}>Basisopstelling ({match.lineup.length})</Text>
          </View>
          {match.lineup.length === 0 ? (
            <View style={styles.emptyLineupContainer}>
              <Users size={48} color="#9CA3AF" />
              <Text style={styles.emptyTitle}>Geen basisopstelling ingesteld</Text>
              <Text style={styles.emptySubtitle}>
                De basisopstelling is nog niet geconfigureerd voor deze wedstrijd
              </Text>
            </View>
          ) : (
            <View style={styles.playersList}>
              {match.lineup.map((player) => (
                <TouchableOpacity
                  key={player.id}
                  style={[
                    styles.playerCard,
                    styles.startingPlayerCard,
                    selectedPlayer?.id === player.id && styles.selectedCard,
                  ]}
                  onPress={() => handlePlayerPress(player, true)}
                >
                  <View style={styles.playerNumber}>
                    <Text style={styles.playerNumberText}>
                      #{player.number || '?'}
                    </Text>
                  </View>
                  <View style={styles.playerInfo}>
                    <Text style={styles.playerName}>{player.name || 'Onbekende speler'}</Text>
                    <View style={styles.positionContainer}>
                      <View
                        style={[
                          styles.positionBadge,
                          { backgroundColor: getPositionColor(player.position) },
                        ]}
                      >
                        <Text style={styles.positionText}>
                          {getPositionDisplayName(player.position)}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.startingIndicator}>
                    <Star size={16} color="#16A34A" fill="#16A34A" />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Users size={20} color="#6B7280" />
            <Text style={styles.sectionTitle}>Bank ({match.reserve_players.length})</Text>
          </View>
          {match.reserve_players.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Users size={32} color="#9CA3AF" />
              <Text style={styles.emptyText}>Geen reservespelers</Text>
              <Text style={styles.emptySubtext}>
                Er zijn momenteel geen reservespelers ingesteld voor deze wedstrijd
              </Text>
            </View>
          ) : (
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
                    <Text style={styles.playerNumberText}>
                      #{player.number || '?'}
                    </Text>
                  </View>
                  <View style={styles.playerInfo}>
                    <Text style={styles.playerName}>{player.name || 'Onbekende speler'}</Text>
                    <View style={styles.positionContainer}>
                      <View
                        style={[
                          styles.positionBadge,
                          { backgroundColor: getPositionColor(player.position) },
                        ]}
                      >
                        <Text style={styles.positionText}>
                          {getPositionDisplayName(player.position)}
                        </Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {match.substitutions.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <ArrowUpDown size={20} color="#EA580C" />
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
  emptyLineupContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 8,
    fontWeight: '500',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 20,
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
  startingPlayerCard: {
    backgroundColor: '#F0FDF4',
    borderColor: '#16A34A',
    borderWidth: 1,
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
    marginBottom: 4,
  },
  positionContainer: {
    flexDirection: 'row',
  },
  positionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  positionText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  startingIndicator: {
    marginLeft: 8,
  },
  substitutionsList: {
    gap: 8,
  },
  substitutionCard: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderLeftWidth: 4,
    borderLeftColor: '#EA580C',
  },
  substitutionTime: {
    marginBottom: 4,
  },
  substitutionTimeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  substitutionDetails: {},
  substitutionText: {
    fontSize: 14,
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