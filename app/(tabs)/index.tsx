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
  Clock,
  MapPin,
  Play,
  ChevronRight,
  Star,
  Target,
  UserCheck,
  ArrowUpDown
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
  lineup: any[];
  reserve_players: any[];
  substitution_schedule: any;
  formation: string;
  formation_key?: string;
  formation_name?: string | null;
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
          .order('date', { ascending: true });

        if (matchesError) throw matchesError;

        const matchList = matches || [];

        const formationIds = Array.from(
          new Set(
            matchList
              .map(m => m.formation_key || m.formation)
              .filter(Boolean)
          )
        );

        let formationsMap: Record<string, string> = {};
        if (formationIds.length > 0) {
          const { data: formationsData } = await supabase
            .from('formations')
            .select('id, name')
            .in('id', formationIds);

          if (formationsData) {
            formationsMap = formationsData.reduce((acc: Record<string, string>, f) => {
              acc[f.id] = f.name;
              return acc;
            }, {});
          }
        }

        const processedMatches = matchList.map(match => {
          const lineupArr = convertPlayersDataToArray(match.lineup);
          const reserveArr = convertPlayersDataToArray(match.reserve_players);
          const formationKey = match.formation_key || match.formation;
          return {
            ...match,
            formation: formationKey,
            lineup: lineupArr,
            reserve_players: reserveArr,
            formation_name: formationsMap[formationKey] || 'Geen formatie',
          } as RecentMatch;
        });

        // Sort matches: upcoming first, then live, then completed
        const sortedMatches = processedMatches.sort((a, b) => {
          const now = new Date();
          const dateA = new Date(a.date);
          const dateB = new Date(b.date);

          const getPriority = (match: any) => {
            if (match.status === 'inProgress' || match.status === 'paused') return 1;
            if (match.status === 'upcoming' && dateA > now) return 2;
            return 3;
          };

          const priorityA = getPriority(a);
          const priorityB = getPriority(b);

          if (priorityA !== priorityB) {
            return priorityA - priorityB;
          }

          return dateA.getTime() - dateB.getTime();
        });

        setRecentMatches(sortedMatches.slice(0, 5));

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
    return date.toLocaleDateString('nl-NL', {
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
        return 'GEPAUZEERD';
      case 'upcoming':
        return 'AANKOMEND';
      case 'completed':
        return 'AFGEROND';
      default:
        return status.toUpperCase();
    }
  };

  const convertPlayersDataToArray = (playersData: any): any[] => {
    if (!playersData) return [];

    if (Array.isArray(playersData)) {
      return playersData.filter(
        player => player && typeof player === 'object' && player.id && player.name
      );
    }

    if (typeof playersData === 'object') {
      const players: any[] = [];
      Object.keys(playersData).forEach(position => {
        const playerData = playersData[position];
        if (playerData && typeof playerData === 'object' && playerData.id && playerData.name) {
          players.push({
            id: playerData.id,
            name: playerData.name,
            number: playerData.number || 0,
            position: playerData.position || position,
          });
        }
      });
      return players;
    }

    return [];
  };

  const getMatchInfo = (match: RecentMatch) => {
    const lineupCount = Array.isArray(match.lineup) ? match.lineup.length : 0;
    const reserveCount = Array.isArray(match.reserve_players) ? match.reserve_players.length : 0;
    const totalPlayers = lineupCount + reserveCount;
    const hasSubSchedule = match.substitution_schedule && Object.keys(match.substitution_schedule).length > 0;

    const formationKey = match.formation_key || match.formation;
    return {
      formation: match.formation_name || formationKey || 'Geen formatie',
      playerCount: totalPlayers,
      hasSubSchedule,
      lineupSet: lineupCount > 0
    };
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Dashboard laden...</Text>
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
              <Text style={styles.welcomeText}>Welkom terug</Text>
              <Text style={styles.userNameText}>Coach</Text>
            </View>
            <Image
              source={require('@/assets/images/we-dohockey-orange-black-trans.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
        </View>

        {/* Compact Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Users size={16} color="#FF6B35" />
            <Text style={styles.statNumber}>{stats.totalTeams}</Text>
            <Text style={styles.statLabel}>Teams</Text>
          </View>
          
          <View style={styles.statCard}>
            <Calendar size={16} color="#F59E0B" />
            <Text style={styles.statNumber}>{stats.upcomingMatches}</Text>
            <Text style={styles.statLabel}>Aankomend</Text>
          </View>

          <View style={styles.statCard}>
            <Play size={16} color="#10B981" />
            <Text style={styles.statNumber}>{stats.liveMatches}</Text>
            <Text style={styles.statLabel}>Live</Text>
          </View>
          
          <View style={styles.statCard}>
            <Trophy size={16} color="#8B5CF6" />
            <Text style={styles.statNumber}>{stats.completedMatches}</Text>
            <Text style={styles.statLabel}>Afgerond</Text>
          </View>
        </View>

        {/* Recent Matches */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Wedstrijden</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/matches')}>
              <Text style={styles.seeAllText}>Bekijk Alles</Text>
            </TouchableOpacity>
          </View>
          
          {recentMatches.length === 0 ? (
            <View style={styles.emptyState}>
              <Calendar size={40} color="#9CA3AF" />
              <Text style={styles.emptyStateTitle}>Nog geen wedstrijden</Text>
              <Text style={styles.emptyStateText}>Je recente wedstrijden verschijnen hier</Text>
            </View>
          ) : (
            <View style={styles.matchesList}>
              {recentMatches.map((match) => {
                const matchInfo = getMatchInfo(match);
                return (
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
                      <ChevronRight size={14} color="#9CA3AF" />
                    </View>
                    
                    <Text style={styles.matchTitle}>
                      {match.home_team} vs {match.away_team}
                    </Text>
                    <Text style={styles.teamName}>{match.teams.name}</Text>
                    
                    <View style={styles.matchDetails}>
                      <View style={styles.matchDetailItem}>
                        <Clock size={12} color="#6B7280" />
                        <Text style={styles.matchDetailText}>
                          {formatDate(match.date)}
                        </Text>
                      </View>
                      <Text style={styles.homeIndicator}>
                        {match.is_home ? 'Thuis' : 'Uit'}
                      </Text>
                    </View>

                    {/* Match Preparation Info */}
                    <View style={styles.preparationInfo}>
                      <View style={styles.preparationRow}>
                        <View style={styles.preparationItem}>
                          <Target size={12} color="#6B7280" />
                          <Text style={styles.preparationText}>
                            {matchInfo.formation}
                          </Text>
                        </View>
                        <View style={styles.preparationItem}>
                          <Users size={12} color="#6B7280" />
                          <Text style={styles.preparationText}>
                            {matchInfo.playerCount} spelers
                          </Text>
                        </View>
                      </View>
                      
                      <View style={styles.preparationRow}>
                        <View style={styles.preparationItem}>
                          <UserCheck size={12} color={matchInfo.lineupSet ? "#10B981" : "#9CA3AF"} />
                          <Text style={[
                            styles.preparationText,
                            { color: matchInfo.lineupSet ? "#10B981" : "#9CA3AF" }
                          ]}>
                            {matchInfo.lineupSet ? 'Opstelling klaar' : 'Opstelling ontbreekt'}
                          </Text>
                        </View>
                        <View style={styles.preparationItem}>
                          <ArrowUpDown size={12} color={matchInfo.hasSubSchedule ? "#10B981" : "#9CA3AF"} />
                          <Text style={[
                            styles.preparationText,
                            { color: matchInfo.hasSubSchedule ? "#10B981" : "#9CA3AF" }
                          ]}>
                            {matchInfo.hasSubSchedule ? 'Wisselschema klaar' : 'Geen wisselschema'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Teams Overview */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Jouw Teams</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/teams')}>
              <Text style={styles.seeAllText}>Bekijk Alles</Text>
            </TouchableOpacity>
          </View>
          
          {teams.length === 0 ? (
            <View style={styles.emptyState}>
              <Users size={40} color="#9CA3AF" />
              <Text style={styles.emptyStateTitle}>Geen teams toegewezen</Text>
              <Text style={styles.emptyStateText}>Je bent nog geen coach van teams</Text>
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
                    <Users size={18} color="#FF6B35" />
                  </View>
                  <View style={styles.teamInfo}>
                    <Text style={styles.teamName}>{team.name}</Text>
                    <Text style={styles.teamPlayers}>
                      {team.players?.length || 0} spelers
                    </Text>
                  </View>
                  <ChevronRight size={14} color="#9CA3AF" />
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
    fontSize: 16,
    color: '#6B7280',
    fontFamily: 'Inter-Medium',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: 20,
    paddingBottom: 20,
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
    fontSize: 14,
    color: '#64748B',
    fontFamily: 'Inter-Regular',
  },
  userNameText: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
    marginTop: 4,
  },
  logoImage: {
    width: 80,
    height: 40,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  statNumber: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
  },
  statLabel: {
    fontSize: 10,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
  },
  section: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
  },
  seeAllText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#FF6B35',
  },
  emptyState: {
    backgroundColor: '#FFFFFF',
    padding: 32,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyStateTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
    marginTop: 12,
    marginBottom: 6,
  },
  emptyStateText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    fontFamily: 'Inter-Regular',
  },
  matchesList: {
    gap: 8,
  },
  matchCard: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  matchStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontFamily: 'Inter-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  matchTitle: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
    marginBottom: 2,
  },
  teamName: {
    fontSize: 12,
    color: '#64748B',
    fontFamily: 'Inter-Medium',
    marginBottom: 8,
  },
  matchDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  matchDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  matchDetailText: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Inter-Regular',
  },
  homeIndicator: {
    fontSize: 10,
    fontFamily: 'Inter-SemiBold',
    color: '#10B981',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  preparationInfo: {
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 6,
    gap: 4,
  },
  preparationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  preparationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  preparationText: {
    fontSize: 10,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  teamsList: {
    gap: 8,
  },
  teamCard: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  teamIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  teamInfo: {
    flex: 1,
  },
  teamName: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#0F172A',
  },
  teamPlayers: {
    fontSize: 10,
    color: '#64748B',
    fontFamily: 'Inter-Regular',
    marginTop: 1,
  },
});