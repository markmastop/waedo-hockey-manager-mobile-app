import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Player } from '@/types/database';
import { ArrowLeft, Users, User } from 'lucide-react-native';

interface Team {
  id: string;
  name: string;
  players: Player[];
  coach: Array<{ id: string; name: string }>;
  created_at: string;
}

export default function TeamDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTeam = async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      // Ensure arrays are properly initialized and sort players by name
      const teamData = {
        ...data,
        players: Array.isArray(data.players) 
          ? data.players.sort((a, b) => a.name.localeCompare(b.name))
          : [],
        coach: Array.isArray(data.coach) ? data.coach : [],
      };

      setTeam(teamData);
    } catch (error) {
      console.error('Error fetching team:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchTeam();
    }
  }, [id]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTeam();
  };

  const getPositionColor = (position: string) => {
    const safePosition = position?.toLowerCase() || '';
    switch (safePosition) {
      case 'goalkeeper':
      case 'gk':
        return '#DC2626';
      case 'defender':
      case 'def':
        return '#1E40AF';
      case 'midfielder':
      case 'mid':
        return '#7C3AED';
      case 'forward':
      case 'fwd':
        return '#EA580C';
      default:
        return '#6B7280';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading team...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!team) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Team not found</Text>
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
          <Text style={styles.teamName}>{team.name}</Text>
          <Text style={styles.teamStats}>
            {team.players.length} players • {team.coach.length} coaches
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Users size={20} color="#16A34A" />
            <Text style={styles.sectionTitle}>
              Players ({team.players.length})
            </Text>
          </View>

          {team.players.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Users size={48} color="#9CA3AF" />
              <Text style={styles.emptyTitle}>No players found</Text>
              <Text style={styles.emptySubtitle}>
                This team doesn't have any players yet
              </Text>
            </View>
          ) : (
            <View style={styles.playersList}>
              {team.players.map((player) => (
                <View key={player.id} style={styles.playerCard}>
                  <View style={styles.playerNumber}>
                    <Text style={styles.playerNumberText}>#{player.number}</Text>
                  </View>
                  <View style={styles.playerInfo}>
                    <Text style={styles.playerName}>{player.name}</Text>
                    <View style={styles.positionContainer}>
                      <View
                        style={[
                          styles.positionBadge,
                          { backgroundColor: getPositionColor(player.position) },
                        ]}
                      >
                        <Text style={styles.positionText}>{player.position || 'Unknown'}</Text>
                      </View>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <User size={20} color="#16A34A" />
            <Text style={styles.sectionTitle}>
              Coaches ({team.coach.length})
            </Text>
          </View>

          <View style={styles.coachesList}>
            {team.coach.map((coach) => (
              <View key={coach.id} style={styles.coachCard}>
                <View style={styles.coachIcon}>
                  <User size={20} color="#16A34A" />
                </View>
                <Text style={styles.coachName}>{coach.name}</Text>
              </View>
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
  teamName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  teamStats: {
    fontSize: 14,
    color: '#6B7280',
  },
  content: {
    flex: 1,
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
  section: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
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
  },
  playersList: {
    gap: 12,
  },
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  playerNumber: {
    width: 48,
    height: 48,
    backgroundColor: '#F0FDF4',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  playerNumberText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#16A34A',
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  positionContainer: {
    flexDirection: 'row',
  },
  positionBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  positionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  coachesList: {
    gap: 12,
  },
  coachCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  coachIcon: {
    width: 40,
    height: 40,
    backgroundColor: '#F0FDF4',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  coachName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
});