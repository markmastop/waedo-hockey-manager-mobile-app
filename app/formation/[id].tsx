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
import { FormationPosition } from '@/types/database';
import { ArrowLeft, Grid3X3, Users } from 'lucide-react-native';

interface Formation {
  id: string;
  key: string;
  name_translations: {
    nl?: string;
    en?: string;
  };
  type: string;
  max_players: number;
  positions: FormationPosition[];
  created_at: string;
}

export default function FormationDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [formation, setFormation] = useState<Formation | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFormation = async () => {
    try {
      const { data, error } = await supabase
        .from('formations')
        .select('*')
        .eq('key', id)
        .single();

      if (error) throw error;

      setFormation(data);
    } catch (error) {
      console.error('Error fetching formation:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchFormation();
    }
  }, [id]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchFormation();
  };

  const getDutchName = (formation: Formation) => {
    return formation.name_translations?.nl || formation.name_translations?.en || formation.key;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Formatie laden...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!formation) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Formatie niet gevonden</Text>
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
          <Text style={styles.formationName}>{getDutchName(formation)}</Text>
          <Text style={styles.formationDetails}>
            {formation.max_players} spelers • {formation.positions?.length || 0} posities
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
            <Grid3X3 size={18} color="#16A34A" />
            <Text style={styles.sectionTitle}>
              Posities ({formation.positions?.length || 0})
            </Text>
          </View>

          {!formation.positions || formation.positions.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Users size={40} color="#9CA3AF" />
              <Text style={styles.emptyTitle}>Geen posities gevonden</Text>
              <Text style={styles.emptySubtitle}>
                Deze formatie heeft nog geen posities gedefinieerd
              </Text>
            </View>
          ) : (
            <View style={styles.positionsList}>
              {formation.positions.map((position, index) => (
                <View key={position.id || index} style={styles.positionCard}>
                  <View style={styles.positionHeader}>
                    <Text style={styles.positionOrder}>#{position.order}</Text>
                    <View style={styles.positionInfo}>
                      <Text style={styles.positionName}>
                        {position.label_translations?.nl || position.dutch_name || position.name}
                      </Text>
                      <Text style={styles.positionSubName}>
                        {position.name}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.positionCoordinates}>
                    <Text style={styles.coordinateText}>
                      X: {position.x}% • Y: {position.y}%
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Grid3X3 size={18} color="#16A34A" />
            <Text style={styles.sectionTitle}>Formatie Details</Text>
          </View>
          
          <View style={styles.detailsCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Type:</Text>
              <Text style={styles.detailValue}>{formation.type || 'Onbekend'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Max Spelers:</Text>
              <Text style={styles.detailValue}>{formation.max_players}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Sleutel:</Text>
              <Text style={styles.detailValue}>{formation.key}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Aangemaakt:</Text>
              <Text style={styles.detailValue}>
                {new Date(formation.created_at).toLocaleDateString('nl-NL')}
              </Text>
            </View>
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
  formationName: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginBottom: 2,
  },
  formationDetails: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Inter-Regular',
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
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
    marginTop: 12,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    fontFamily: 'Inter-Regular',
  },
  positionsList: {
    gap: 8,
  },
  positionCard: {
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
  positionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  positionOrder: {
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    color: '#16A34A',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 10,
    minWidth: 24,
    textAlign: 'center',
  },
  positionInfo: {
    flex: 1,
  },
  positionName: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 1,
  },
  positionSubName: {
    fontSize: 10,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  positionCoordinates: {
    alignItems: 'flex-end',
  },
  coordinateText: {
    fontSize: 10,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
  },
  detailsCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  detailLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  detailValue: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
});