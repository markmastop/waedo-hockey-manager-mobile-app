import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  SafeAreaView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';
import { 
  Users, 
  User, 
  ChevronRight, 
  Trophy,
  Calendar,
  Star,
  Shield
} from 'lucide-react-native';
import { Player } from '@/types/database';

interface Team {
  id: string;
  name: string;
  players: Player[];
  coach: Array<{ id: string; name: string }>;
  created_at: string;
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
        .contains('coach', JSON.stringify([{ id: user.id }]))
        .order('name');

      if (error) throw error;
      
      // Ensure arrays are properly initialized
      const teamsData = (data || []).map(team => ({
        ...team,
        players: Array.isArray(team.players) ? team.players : [],
        coach: Array.isArray(team.coach) ? team.coach : [],
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

  const handleTeamPress = (teamId: string) => {
    router.push(`/team/${teamId}`);
  };

  const getPositionColor = (position: string) => {
    const safePosition = position?.toLowerCase() || '';
    switch (safePosition) {
      case 'goalkeeper':
      case 'gk':
      case 'keeper':
        return '#EF4444';
      case 'defender':
      case 'def':
      case 'verdediger':
        return '#3B82F6';
      case 'midfielder':
      case 'mid':
      case 'middenvelder':
        return '#8B5CF6';
      case 'forward':
      case 'fwd':
      case 'aanvaller':
        return '#F59E0B';
      default:
        return '#6B7280';
    }
  };

  const getPositionIcon = (position: string) => {
    const safePosition = position?.toLowerCase() || '';
    switch (safePosition) {
      case 'goalkeeper':
      case 'gk':
      case 'keeper':
        return Shield;
      default:
        return User;
    }
  };

  const getTeamStats = (team: Team) => {
    const positions = team.players.reduce((acc, player) => {
      const pos = player.position?.toLowerCase() || 'unknown';
      acc[pos] = (acc[pos] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalPlayers: team.players.length,
      goalkeepers: positions.goalkeeper || positions.gk || positions.keeper || 0,
      defenders: positions.defender || positions.def || positions.verdediger || 0,
      midfielders: positions.midfielder || positions.mid || positions.middenvelder || 0,
      forwards: positions.forward || positions.fwd || positions.aanvaller || 0,
    };
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Teams laden...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mijn Teams</Text>
        <Text style={styles.subtitle}>Teams waar je coach van bent</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {teams.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Users size={48} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>Geen teams toegewezen</Text>
            <Text style={styles.emptySubtitle}>
              Je bent momenteel geen coach van teams
            </Text>
          </View>
        ) : (
          <View style={styles.teamList}>
            {teams.map((team) => {
              const stats = getTeamStats(team);
              return (
                <TouchableOpacity
                  key={team.id}
                  style={styles.teamCard}
                  onPress={() => handleTeamPress(team.id)}
                >
                  {/* Team Header */}
                  <View style={styles.teamHeader}>
                    <View style={styles.teamIconContainer}>
                      <View style={styles.teamIcon}>
                        <Users size={24} color="#FF6B35" />
                      </View>
                      <View style={styles.teamBadge}>
                        <Star size={10} color="#FFFFFF" fill="#FFFFFF" />
                      </View>
                    </View>
                    <View style={styles.teamInfo}>
                      <Text style={styles.teamName}>{team.name}</Text>
                      <Text style={styles.teamStats}>
                        {stats.totalPlayers} spelers • {team.coach.length} coaches
                      </Text>
                    </View>
                    <ChevronRight size={18} color="#9CA3AF" />
                  </View>

                  {/* Team Stats */}
                  <View style={styles.statsContainer}>
                    <View style={styles.statsGrid}>
                      <View style={styles.statItem}>
                        <View style={[styles.statIcon, { backgroundColor: '#FEF2F2' }]}>
                          <Shield size={14} color="#EF4444" />
                        </View>
                        <Text style={styles.statNumber}>{stats.goalkeepers}</Text>
                        <Text style={styles.statLabel}>KP</Text>
                      </View>
                      
                      <View style={styles.statItem}>
                        <View style={[styles.statIcon, { backgroundColor: '#EFF6FF' }]}>
                          <User size={14} color="#3B82F6" />
                        </View>
                        <Text style={styles.statNumber}>{stats.defenders}</Text>
                        <Text style={styles.statLabel}>VER</Text>
                      </View>
                      
                      <View style={styles.statItem}>
                        <View style={[styles.statIcon, { backgroundColor: '#F3E8FF' }]}>
                          <User size={14} color="#8B5CF6" />
                        </View>
                        <Text style={styles.statNumber}>{stats.midfielders}</Text>
                        <Text style={styles.statLabel}>MID</Text>
                      </View>
                      
                      <View style={styles.statItem}>
                        <View style={[styles.statIcon, { backgroundColor: '#FFFBEB' }]}>
                          <User size={14} color="#F59E0B" />
                        </View>
                        <Text style={styles.statNumber}>{stats.forwards}</Text>
                        <Text style={styles.statLabel}>AAN</Text>
                      </View>
                    </View>
                  </View>

                  {/* Recent Players Preview */}
                  <View style={styles.playersPreview}>
                    <Text style={styles.previewTitle}>Recente Spelers</Text>
                    <View style={styles.playersList}>
                      {team.players.slice(0, 6).map((player, index) => (
                        <View key={player.id} style={styles.playerChip}>
                          <View 
                            style={[
                              styles.playerNumber, 
                              { backgroundColor: getPositionColor(player.position) }
                            ]}
                          >
                            <Text style={styles.playerNumberText}>
                              {player.number || '?'}
                            </Text>
                          </View>
                          <Text style={styles.playerName} numberOfLines={1}>
                            {player.name}
                          </Text>
                        </View>
                      ))}
                      {team.players.length > 6 && (
                        <View style={styles.morePlayersChip}>
                          <Text style={styles.morePlayersText}>
                            +{team.players.length - 6}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Coaches */}
                  <View style={styles.coachesSection}>
                    <Text style={styles.previewTitle}>Coaching Staf</Text>
                    <View style={styles.coachesList}>
                      {team.coach.map((coach) => (
                        <View key={coach.id} style={styles.coachItem}>
                          <Image
                            source={{ uri: 'https://images.pexels.com/photos/1040880/pexels-photo-1040880.jpeg?auto=compress&cs=tinysrgb&w=40&h=40&dpr=2' }}
                            style={styles.coachAvatar}
                          />
                          <Text style={styles.coachName}>{coach.name}</Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  {/* Quick Actions */}
                  <View style={styles.quickActions}>
                    <TouchableOpacity style={styles.actionButton}>
                      <Calendar size={14} color="#FF6B35" />
                      <Text style={styles.actionButtonText}>Bekijk Wedstrijden</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionButton}>
                      <Trophy size={14} color="#FF6B35" />
                      <Text style={styles.actionButtonText}>Formaties</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  title: {
    fontSize: 28,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    fontFamily: 'Inter-Regular',
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#374151',
    marginTop: 20,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    fontFamily: 'Inter-Regular',
    lineHeight: 20,
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
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  teamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  teamIconContainer: {
    position: 'relative',
    marginRight: 12,
  },
  teamIcon: {
    width: 48,
    height: 48,
    backgroundColor: '#FEF2F2',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 16,
    height: 16,
    backgroundColor: '#FF6B35',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  teamInfo: {
    flex: 1,
  },
  teamName: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
    marginBottom: 2,
  },
  teamStats: {
    fontSize: 12,
    color: '#64748B',
    fontFamily: 'Inter-Regular',
  },
  statsContainer: {
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  statNumber: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
    marginBottom: 1,
  },
  statLabel: {
    fontSize: 10,
    fontFamily: 'Inter-Medium',
    color: '#64748B',
  },
  playersPreview: {
    marginBottom: 16,
  },
  previewTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
    marginBottom: 10,
  },
  playersList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  playerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
    maxWidth: '48%',
  },
  playerNumber: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerNumberText: {
    fontSize: 10,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  playerName: {
    fontSize: 10,
    color: '#374151',
    fontFamily: 'Inter-Medium',
    flex: 1,
  },
  morePlayersChip: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 16,
  },
  morePlayersText: {
    fontSize: 10,
    color: '#6B7280',
    fontFamily: 'Inter-SemiBold',
  },
  coachesSection: {
    marginBottom: 16,
  },
  coachesList: {
    gap: 6,
  },
  coachItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  coachAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  coachName: {
    fontSize: 12,
    color: '#374151',
    fontFamily: 'Inter-Medium',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 4,
  },
  actionButtonText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#FF6B35',
  },
});