import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  SafeAreaView,
  Image,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';
import { 
  Calendar, 
  Users, 
  Trophy, 
  TrendingUp, 
  Clock,
  MapPin,
  Play,
  ChevronRight,
  Star
} from 'lucide-react-native';

interface DashboardStats {
  totalTeams: number;
  upcomingMatches: number;
  liveMatches: number;
  completedMatches: number;
}

interface RecentMatch {
  id: string;
  date: string;
  home_team: string;
  away_team: string;
  status: string;
  is_home: boolean;
  teams: { name: string };
}

interface Team {
  id: string;
  name: string;
  players: any[];
}

export default function DashboardScreen() {
  const [stats, setStats] = useState<DashboardStats>({
    totalTeams: 0,
    upcomingMatches: 0,
    liveMatches: 0,
    completedMatches: 0,
  });
  const [recentMatches, setRecentMatches] = useState<RecentMatch[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();

  const fetchDashboardData = async () => {
    if (!user) return;

    try {
      // Get teams where user is a coach
      const { data: userTeams, error: teamsError } = await supabase
        .from('teams')
        .select('id, name, players')
        .contains('coach', JSON.stringify([{ id: user.id }]));

      if (teamsError) throw teamsError;

      const teamIds = userTeams?.map(team => team.id) || [];
      setTeams(userTeams || []);

      if (teamIds.length > 0) {
        // Get matches for these teams
        const { data: matches, error: matchesError } = await supabase
          .from('matches')
          .select(`
            *,
            teams (name)
          `)
          .in('team_id', teamIds)
          .order('date', { ascending: false })
          .limit(5);

        if (matchesError) throw matchesError;

        setRecentMatches(matches || []);

        // Calculate stats
        const now = new Date();
        const upcoming = matches?.filter(m => 
          new Date(m.date) > now && m.status === 'upcoming'
        ).length || 0;
        
        const live = matches?.filter(m => 
          m.status === 'inProgress' || m.status === 'paused'
        ).length || 0;
        
        const completed = matches?.filter(m => 
          m.status === 'completed'
        ).length || 0;

        setStats({
          totalTeams: userTeams?.length || 0,
          upcomingMatches: upcoming,
          liveMatches: live,
          completedMatches: completed,
        });
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'inProgress':
      case 'paused':
        return '#10B981';
      case 'upcoming':
        return '#F59E0B';
      case 'completed':
        return '#6B7280';
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
      case 'completed':
        return 'COMPLETED';
      default:
        return status.toUpperCase();
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.welcomeText}>Welcome back</Text>
              <Text style={styles.userNameText}>Coach</Text>
            </View>
            <Image
              source={{ uri: 'https://images.pexels.com/photos/1040880/pexels-photo-1040880.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&dpr=2' }}
              style={styles.profileImage}
            />
          </View>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statsRow}>
            <View style={[styles.statCard, styles.primaryCard]}>
              <View style={styles.statIconContainer}>
                <Users size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.statNumber}>{stats.totalTeams}</Text>
              <Text style={styles.statLabel}>Teams</Text>
            </View>
            
            <View style={[styles.statCard, styles.secondaryCard]}>
              <View style={[styles.statIconContainer, styles.secondaryIcon]}>
                <Calendar size={24} color="#FF6B35" />
              </View>
              <Text style={[styles.statNumber, styles.darkText]}>{stats.upcomingMatches}</Text>
              <Text style={[styles.statLabel, styles.darkLabel]}>Upcoming</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={[styles.statCard, styles.secondaryCard]}>
              <View style={[styles.statIconContainer, styles.secondaryIcon]}>
                <Play size={24} color="#10B981" />
              </View>
              <Text style={[styles.statNumber, styles.darkText]}>{stats.liveMatches}</Text>
              <Text style={[styles.statLabel, styles.darkLabel]}>Live</Text>
            </View>
            
            <View style={[styles.statCard, styles.secondaryCard]}>
              <View style={[styles.statIconContainer, styles.secondaryIcon]}>
                <Trophy size={24} color="#8B5CF6" />
              </View>
              <Text style={[styles.statNumber, styles.darkText]}>{stats.completedMatches}</Text>
              <Text style={[styles.statLabel, styles.darkLabel]}>Completed</Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsContainer}>
            <TouchableOpacity 
              style={styles.quickActionCard}
              onPress={() => router.push('/(tabs)/matches')}
            >
              <View style={styles.quickActionIcon}>
                <Calendar size={24} color="#FF6B35" />
              </View>
              <Text style={styles.quickActionText}>View Matches</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.quickActionCard}
              onPress={() => router.push('/(tabs)/teams')}
            >
              <View style={styles.quickActionIcon}>
                <Users size={24} color="#FF6B35" />
              </View>
              <Text style={styles.quickActionText}>Manage Teams</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Matches */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Matches</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/matches')}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          
          {recentMatches.length === 0 ? (
            <View style={styles.emptyState}>
              <Calendar size={48} color="#9CA3AF" />
              <Text style={styles.emptyStateTitle}>No matches yet</Text>
              <Text style={styles.emptyStateText}>Your recent matches will appear here</Text>
            </View>
          ) : (
            <View style={styles.matchesList}>
              {recentMatches.map((match) => (
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
                    <ChevronRight size={16} color="#9CA3AF" />
                  </View>
                  
                  <Text style={styles.matchTitle}>
                    {match.home_team} vs {match.away_team}
                  </Text>
                  <Text style={styles.teamName}>{match.teams.name}</Text>
                  
                  <View style={styles.matchDetails}>
                    <View style={styles.matchDetailItem}>
                      <Clock size={14} color="#6B7280" />
                      <Text style={styles.matchDetailText}>
                        {formatDate(match.date)}
                      </Text>
                    </View>
                    <Text style={styles.homeIndicator}>
                      {match.is_home ? 'Home' : 'Away'}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Teams Overview */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your Teams</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/teams')}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          
          {teams.length === 0 ? (
            <View style={styles.emptyState}>
              <Users size={48} color="#9CA3AF" />
              <Text style={styles.emptyStateTitle}>No teams assigned</Text>
              <Text style={styles.emptyStateText}>You're not coaching any teams yet</Text>
            </View>
          ) : (
            <View style={styles.teamsList}>
              {teams.slice(0, 3).map((team) => (
                <TouchableOpacity
                  key={team.id}
                  style={styles.teamCard}
                  onPress={() => router.push(`/team/${team.id}`)}
                >
                  <View style={styles.teamIcon}>
                    <Users size={20} color="#FF6B35" />
                  </View>
                  <View style={styles.teamInfo}>
                    <Text style={styles.teamName}>{team.name}</Text>
                    <Text style={styles.teamPlayers}>
                      {team.players?.length || 0} players
                    </Text>
                  </View>
                  <ChevronRight size={16} color="#9CA3AF" />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
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
    fontFamily: 'Inter-Medium',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: 20,
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  welcomeText: {
    fontSize: 16,
    color: '#64748B',
    fontFamily: 'Inter-Regular',
  },
  userNameText: {
    fontSize: 28,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
    marginTop: 4,
  },
  profileImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  statsContainer: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    gap: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  statCard: {
    flex: 1,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  primaryCard: {
    backgroundColor: '#FF6B35',
  },
  secondaryCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  secondaryIcon: {
    backgroundColor: '#F8FAFC',
  },
  statNumber: {
    fontSize: 32,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  darkText: {
    color: '#0F172A',
  },
  statLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  darkLabel: {
    color: '#64748B',
  },
  section: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
  },
  seeAllText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#FF6B35',
  },
  quickActionsContainer: {
    flexDirection: 'row',
    gap: 16,
  },
  quickActionCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  quickActionText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#0F172A',
    textAlign: 'center',
  },
  emptyState: {
    backgroundColor: '#FFFFFF',
    padding: 40,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyStateTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    fontFamily: 'Inter-Regular',
  },
  matchesList: {
    gap: 12,
  },
  matchCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  matchTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
    marginBottom: 4,
  },
  teamName: {
    fontSize: 14,
    color: '#64748B',
    fontFamily: 'Inter-Medium',
    marginBottom: 12,
  },
  matchDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  matchDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  matchDetailText: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter-Regular',
  },
  homeIndicator: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#10B981',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  teamsList: {
    gap: 12,
  },
  teamCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  teamIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  teamInfo: {
    flex: 1,
  },
  teamPlayers: {
    fontSize: 12,
    color: '#64748B',
    fontFamily: 'Inter-Regular',
    marginTop: 2,
  },
});