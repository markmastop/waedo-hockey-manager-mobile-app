import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  SafeAreaView,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';
import { Calendar, MapPin, Clock, Users } from 'lucide-react-native';

interface Match {
  id: string;
  team_id: string;
  date: string;
  home_team: string;
  away_team: string;
  location: string;
  field: string;
  status: 'upcoming' | 'inProgress' | 'paused' | 'completed';
  is_home: boolean;
  teams: {
    name: string;
  };
}

export default function MatchesScreen() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();

  const fetchMatches = async () => {
    if (!user) return;

    try {
      // First, get teams where the current user is a coach
      const { data: userTeams, error: teamsError } = await supabase
        .from('teams')
        .select('id')
        .or(`coaches.cs.{"id":"${user.id}"},coach.cs.{"id":"${user.id}"}`);

      if (teamsError) throw teamsError;

      if (!userTeams || userTeams.length === 0) {
        setMatches([]);
        return;
      }

      // Extract team IDs
      const teamIds = userTeams.map(team => team.id);

      // Then fetch matches for those teams
      const { data, error } = await supabase
        .from('matches')
        .select(`
          *,
          teams (
            name
          )
        `)
        .in('team_id', teamIds)
        .in('status', ['upcoming', 'inProgress', 'paused'])
        .gte('date', new Date().toISOString().split('T')[0])
        .order('date', { ascending: true });

      if (error) throw error;
      setMatches(data || []);
    } catch (error) {
      console.error('Error fetching matches:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchMatches();
    }
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchMatches();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'inProgress':
        return '#059669';
      case 'paused':
        return '#EA580C';
      case 'upcoming':
        return '#16A34A';
      default:
        return '#6B7280';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'inProgress':
        return 'LIVE';
      case 'paused':
        return 'PAUSED';
      case 'upcoming':
        return 'UPCOMING';
      default:
        return status.toUpperCase();
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading matches...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Matches</Text>
        <Text style={styles.subtitle}>Matches for teams you're coaching</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {matches.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Calendar size={48} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>No matches found</Text>
            <Text style={styles.emptySubtitle}>
              You don't have any upcoming matches for teams you're coaching
            </Text>
          </View>
        ) : (
          <View style={styles.matchList}>
            {matches.map((match) => (
              <TouchableOpacity
                key={match.id}
                style={styles.matchCard}
                onPress={() => router.push(`/match/${match.id}`)}
              >
                <View style={styles.matchHeader}>
                  <View style={styles.matchStatus}>
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: getStatusColor(match.status) },
                      ]}
                    />
                    <Text
                      style={[
                        styles.statusText,
                        { color: getStatusColor(match.status) },
                      ]}
                    >
                      {getStatusText(match.status)}
                    </Text>
                  </View>
                  <Text style={styles.teamName}>{match.teams.name}</Text>
                </View>

                <View style={styles.matchDetails}>
                  <Text style={styles.matchTitle}>
                    {match.home_team} vs {match.away_team}
                  </Text>
                  <Text style={styles.homeIndicator}>
                    {match.is_home ? '(Home)' : '(Away)'}
                  </Text>
                </View>

                <View style={styles.matchInfo}>
                  <View style={styles.infoRow}>
                    <Clock size={16} color="#6B7280" />
                    <Text style={styles.infoText}>
                      {formatDate(match.date)} • {formatTime(match.date)}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <MapPin size={16} color="#6B7280" />
                    <Text style={styles.infoText}>
                      {match.location}
                      {match.field && ` • ${match.field}`}
                    </Text>
                  </View>
                </View>

                <View style={styles.matchActions}>
                  <View style={styles.coachButton}>
                    <Users size={16} color="#16A34A" />
                    <Text style={styles.coachButtonText}>Start Coaching</Text>
                  </View>
                </View>
              </TouchableOpacity>
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
  matchList: {
    padding: 20,
    gap: 16,
  },
  matchCard: {
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
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  matchStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  teamName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  matchDetails: {
    marginBottom: 12,
  },
  matchTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  homeIndicator: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '600',
  },
  matchInfo: {
    gap: 8,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#6B7280',
  },
  matchActions: {
    alignItems: 'flex-end',
  },
  coachButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  coachButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#16A34A',
  },
});