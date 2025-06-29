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
import { ArrowLeft, Calendar, MapPin, Clock, Users } from 'lucide-react-native';

interface Match {
  id: string;
  team_id: string;
  date: string;
  home_team: string;
  away_team: string;
  location: string;
  field: string;
  formation: string;
  formation_key?: string;
  match_key?: string;
  status: 'upcoming' | 'inProgress' | 'paused' | 'completed';
  is_home: boolean;
  teams: {
    name: string;
  };
}

export default function MatchDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMatch = async () => {
    try {
      const { data, error } = await supabase
        .from('matches')
        .select(`
          *,
          teams (name)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      setMatch(data);
    } catch (error) {
      console.error('Error fetching match:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchMatch();
    }
  }, [id]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchMatch();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('nl-NL', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
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
        <View style={styles.statusContainer}>
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
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Calendar size={18} color="#16A34A" />
            <Text style={styles.sectionTitle}>Wedstrijd Details</Text>
          </View>
          
          <View style={styles.detailsCard}>
            <View style={styles.detailRow}>
              <View style={styles.detailItem}>
                <Clock size={16} color="#6B7280" />
                <Text style={styles.detailText}>
                  {formatDate(match.date)} om {formatTime(match.date)}
                </Text>
              </View>
            </View>
            
            <View style={styles.detailRow}>
              <View style={styles.detailItem}>
                <MapPin size={16} color="#6B7280" />
                <Text style={styles.detailText}>
                  {match.location}
                  {match.field && ` • ${match.field}`}
                </Text>
              </View>
            </View>

            {match.match_key && (
              <View style={styles.detailRow}>
                <View style={styles.detailItem}>
                  <Users size={16} color="#6B7280" />
                  <Text style={styles.detailText}>
                    Wedstrijd: {match.match_key}
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.detailRow}>
              <Text style={styles.homeIndicator}>
                {match.is_home ? 'Thuiswedstrijd' : 'Uitwedstrijd'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Users size={18} color="#16A34A" />
            <Text style={styles.sectionTitle}>Formatie</Text>
          </View>
          
          <View style={styles.formationCard}>
            <Text style={styles.formationText}>
              {match.formation || 'Geen formatie geselecteerd'}
            </Text>
            {match.formation_key && (
              <TouchableOpacity
                style={styles.formationButton}
                onPress={() => router.push(`/formation/${match.formation_key}`)}
              >
                <Text style={styles.formationButtonText}>Bekijk Formatie</Text>
              </TouchableOpacity>
            )}
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
  matchTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  teamName: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Inter-Regular',
  },
  statusContainer: {
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
    fontSize: 10,
    fontFamily: 'Inter-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
    fontFamily: 'Inter-Medium',
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
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  detailsCard: {
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
  detailRow: {
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#374151',
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
    alignSelf: 'flex-start',
  },
  formationCard: {
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
  formationText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 12,
  },
  formationButton: {
    backgroundColor: '#16A34A',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  formationButtonText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
});