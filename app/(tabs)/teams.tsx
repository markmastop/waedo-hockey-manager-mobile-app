import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  SafeAreaView,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Users, User } from 'lucide-react-native';
import { Player } from '@/types/database';

interface Team {
  id: string;
  name: string;
  players: Player[];
  coaches: Array<{ id: string; name: string }>;
}

export default function TeamsScreen() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();

  const fetchTeams = async () => {
    if (!user) return;

    try {
      // Only fetch teams where the current user is a coach
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .or(`coaches.cs.{"id":"${user.id}"},coach.cs.{"id":"${user.id}"}`)
        .order('name');

      if (error) throw error;
      
      // Ensure arrays are properly initialized
      const teamsData = (data || []).map(team => ({
        ...team,
        players: Array.isArray(team.players) ? team.players : [],
        coaches: Array.isArray(team.coaches) ? team.coaches : (Array.isArray(team.coach) ? team.coach : []),
      }));
      
      setTeams(teamsData);
    } catch (error) {
      console.error('Error fetching teams:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchTeams();
    }
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTeams();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading teams...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Teams</Text>
        <Text style={styles.subtitle}>Teams you're coaching</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {teams.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Users size={48} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>No teams found</Text>
            <Text style={styles.emptySubtitle}>
              You're not currently assigned as a coach to any teams
            </Text>
          </View>
        ) : (
          <View style={styles.teamList}>
            {teams.map((team) => (
              <View key={team.id} style={styles.teamCard}>
                <View style={styles.teamHeader}>
                  <View style={styles.teamIcon}>
                    <Users size={24} color="#16A34A" />
                  </View>
                  <View style={styles.teamInfo}>
                    <Text style={styles.teamName}>{team.name}</Text>
                    <Text style={styles.teamStats}>
                      {team.players.length} players • {team.coaches.length} coaches
                    </Text>
                  </View>
                </View>

                <View style={styles.playersSection}>
                  <Text style={styles.sectionTitle}>Players</Text>
                  <View style={styles.playersList}>
                    {team.players.slice(0, 8).map((player, index) => (
                      <View key={player.id} style={styles.playerChip}>
                        <Text style={styles.playerNumber}>#{player.number}</Text>
                        <Text style={styles.playerName}>{player.name}</Text>
                      </View>
                    ))}
                    {team.players.length > 8 && (
                      <View style={styles.morePlayersChip}>
                        <Text style={styles.morePlayersText}>
                          +{team.players.length - 8} more
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                <View style={styles.coachesSection}>
                  <Text style={styles.sectionTitle}>Coaches</Text>
                  <View style={styles.coachesList}>
                    {team.coaches.map((coach) => (
                      <View key={coach.id} style={styles.coachItem}>
                        <User size={16} color="#6B7280" />
                        <Text style={styles.coachName}>{coach.name}</Text>
                      </View>
                    ))}
                  </View>
                </View>
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
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
  },
  scrollView: {
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  teamList: {
    padding: 20,
    gap: 16,
  },
  teamCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  teamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  teamIcon: {
    width: 48,
    height: 48,
    backgroundColor: '#F0FDF4',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  teamInfo: {
    flex: 1,
  },
  teamName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  teamStats: {
    fontSize: 14,
    color: '#6B7280',
  },
  playersSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  playersList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  playerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  playerNumber: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#16A34A',
  },
  playerName: {
    fontSize: 12,
    color: '#374151',
  },
  morePlayersChip: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  morePlayersText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  coachesSection: {},
  coachesList: {
    gap: 8,
  },
  coachItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  coachName: {
    fontSize: 14,
    color: '#374151',
  },
});