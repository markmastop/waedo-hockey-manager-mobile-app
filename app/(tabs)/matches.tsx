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
import { 
  Calendar, 
  MapPin, 
  Clock, 
  Users, 
  Play,
  Filter,
  Search
} from 'lucide-react-native';

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

type FilterType = 'all' | 'upcoming' | 'live' | 'completed';

export default function MatchesScreen() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [filteredMatches, setFilteredMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const { user } = useAuth();

  const fetchMatches = async () => {
    if (!user) return;

    try {
      // First, get teams where the current user is a coach
      const { data: userTeams, error: teamsError } = await supabase
        .from('teams')
        .select('id')
        .contains('coach', JSON.stringify([{ id: user.id }]));

      if (teamsError) throw teamsError;

      if (!userTeams || userTeams.length === 0) {
        setMatches([]);
        setFilteredMatches([]);
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
        .order('date', { ascending: true });

      if (error) throw error;
      
      const matchesData = data || [];
      setMatches(matchesData);
      filterMatches(matchesData, activeFilter);
    } catch (error) {
      console.error('Error fetching matches:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filterMatches = (matchesData: Match[], filter: FilterType) => {
    let filtered = matchesData;
    
    switch (filter) {
      case 'upcoming':
        filtered = matchesData.filter(match => match.status === 'upcoming');
        break;
      case 'live':
        filtered = matchesData.filter(match => 
          match.status === 'inProgress' || match.status === 'paused'
        );
        break;
      case 'completed':
        filtered = matchesData.filter(match => match.status === 'completed');
        break;
      default:
        filtered = matchesData;
    }
    
    setFilteredMatches(filtered);
  };

  const handleFilterChange = (filter: FilterType) => {
    setActiveFilter(filter);
    filterMatches(matches, filter);
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
    return date.toLocaleDateString('nl-NL', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('nl-NL', {
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

  const getFilterCount = (filter: FilterType) => {
    switch (filter) {
      case 'upcoming':
        return matches.filter(m => m.status === 'upcoming').length;
      case 'live':
        return matches.filter(m => m.status === 'inProgress' || m.status === 'paused').length;
      case 'completed':
        return matches.filter(m => m.status === 'completed').length;
      default:
        return matches.length;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Wedstrijden laden...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Wedstrijden</Text>
        <Text style={styles.subtitle}>Beheer je teamwedstrijden</Text>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContent}
        >
          {[
            { key: 'all', label: 'Alle' },
            { key: 'upcoming', label: 'Aankomend' },
            { key: 'live', label: 'Live' },
            { key: 'completed', label: 'Afgerond' },
          ].map((filter) => (
            <TouchableOpacity
              key={filter.key}
              style={[
                styles.filterTab,
                activeFilter === filter.key && styles.activeFilterTab,
              ]}
              onPress={() => handleFilterChange(filter.key as FilterType)}
            >
              <Text
                style={[
                  styles.filterTabText,
                  activeFilter === filter.key && styles.activeFilterTabText,
                ]}
              >
                {filter.label}
              </Text>
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>
                  {getFilterCount(filter.key as FilterType)}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {filteredMatches.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Calendar size={48} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>Geen wedstrijden gevonden</Text>
            <Text style={styles.emptySubtitle}>
              {activeFilter === 'all' 
                ? "Je hebt geen wedstrijden ingepland"
                : `Geen ${activeFilter === 'upcoming' ? 'aankomende' : activeFilter === 'live' ? 'live' : 'afgeronde'} wedstrijden gevonden`
              }
            </Text>
          </View>
        ) : (
          <View style={styles.matchList}>
            {filteredMatches.map((match) => (
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
                  <View style={styles.homeIndicatorContainer}>
                    <Text style={[
                      styles.homeIndicator,
                      match.is_home ? styles.homeMatch : styles.awayMatch
                    ]}>
                      {match.is_home ? 'THUIS' : 'UIT'}
                    </Text>
                  </View>
                </View>

                <View style={styles.matchInfo}>
                  <View style={styles.infoRow}>
                    <Clock size={14} color="#6B7280" />
                    <Text style={styles.infoText}>
                      {formatDate(match.date)} • {formatTime(match.date)}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <MapPin size={14} color="#6B7280" />
                    <Text style={styles.infoText}>
                      {match.location}
                      {match.field && ` • ${match.field}`}
                    </Text>
                  </View>
                </View>

                {(match.status === 'inProgress' || match.status === 'paused') && (
                  <View style={styles.liveActions}>
                    <View style={styles.liveButton}>
                      <Play size={14} color="#10B981" />
                      <Text style={styles.liveButtonText}>Beheer Live</Text>
                    </View>
                  </View>
                )}

                {match.status === 'upcoming' && (
                  <View style={styles.upcomingActions}>
                    <View style={styles.upcomingButton}>
                      <Users size={14} color="#FF6B35" />
                      <Text style={styles.upcomingButtonText}>Team Voorbereiden</Text>
                    </View>
                  </View>
                )}
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
  filterContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  filterScrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    gap: 6,
  },
  activeFilterTab: {
    backgroundColor: '#FF6B35',
  },
  filterTabText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#64748B',
  },
  activeFilterTabText: {
    color: '#FFFFFF',
  },
  filterBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
    minWidth: 16,
    alignItems: 'center',
  },
  filterBadgeText: {
    fontSize: 10,
    fontFamily: 'Inter-Bold',
    color: '#64748B',
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
  matchList: {
    padding: 20,
    gap: 12,
  },
  matchCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
  teamName: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#64748B',
  },
  matchDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  matchTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
    flex: 1,
    marginRight: 10,
  },
  homeIndicatorContainer: {
    alignItems: 'flex-end',
  },
  homeIndicator: {
    fontSize: 10,
    fontFamily: 'Inter-Bold',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  homeMatch: {
    color: '#10B981',
    backgroundColor: '#ECFDF5',
  },
  awayMatch: {
    color: '#F59E0B',
    backgroundColor: '#FFFBEB',
  },
  matchInfo: {
    gap: 6,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoText: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Inter-Regular',
  },
  liveActions: {
    alignItems: 'flex-end',
  },
  liveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  liveButtonText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#10B981',
  },
  upcomingActions: {
    alignItems: 'flex-end',
  },
  upcomingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  upcomingButtonText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#FF6B35',
  },
});