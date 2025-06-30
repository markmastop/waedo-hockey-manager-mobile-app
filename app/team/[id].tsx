/** Screen showing team details and roster. */
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
import { PlayerCard } from '@/components/PlayerCard';
import { getPositionColor } from '@/lib/playerPositions';

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


  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Team laden...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!team) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Team niet gevonden</Text>
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
          <Text style={styles.teamName}>{team.name}</Text>
          <Text style={styles.teamStats}>
            {team.players.length} spelers • {team.coach.length} coaches
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
            <Users size={18} color="#16A34A" />
            <Text style={styles.sectionTitle}>
              Spelers ({team.players.length})
            </Text>
          </View>

          {team.players.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Users size={40} color="#9CA3AF" />
              <Text style={styles.emptyTitle}>Geen spelers gevonden</Text>
              <Text style={styles.emptySubtitle}>
                Dit team heeft nog geen spelers
              </Text>
            </View>
          ) : (
            <View style={styles.playersList}>
              {team.players.map((player) => (
                <PlayerCard key={player.id} player={player} />
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <User size={18} color="#16A34A" />
            <Text style={styles.sectionTitle}>
              Coaches ({team.coach.length})
            </Text>
          </View>

          <View style={styles.coachesList}>
            {team.coach.map((coach) => (
              <View key={coach.id} style={styles.coachCard}>
                <View style={styles.coachIcon}>
                  <User size={18} color="#16A34A" />
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
  teamName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 2,
  },
  teamStats: {
    fontSize: 12,
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
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 32,
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
  },
  playersList: {
    gap: 8,
  },
  coachesList: {
    gap: 8,
  },
  coachCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  coachIcon: {
    width: 32,
    height: 32,
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  coachName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
});