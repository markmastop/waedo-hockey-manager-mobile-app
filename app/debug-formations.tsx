/** Debug screen listing stored formations. */
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, SafeAreaView } from 'react-native';
import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { TouchableOpacity } from 'react-native';

export default function DebugFormationsScreen() {
  const [formations, setFormations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllFormations();
  }, []);

  const fetchAllFormations = async () => {
    try {
      console.log('🔍 Fetching all formations...');
      
      const { data, error } = await supabase
        .from('formations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching formations:', error);
        return;
      }

      console.log('✅ All formations data:', data);
      setFormations(data || []);
    } catch (error) {
      console.error('💥 Exception fetching formations:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading formations...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={24} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.title}>Debug: Formations Data</Text>
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.sectionTitle}>
          Found {formations.length} formations in database:
        </Text>

        {formations.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No formations found in database</Text>
          </View>
        ) : (
          formations.map((formation, index) => (
            <View key={formation.id} style={styles.formationCard}>
              <Text style={styles.formationTitle}>
                Formation #{index + 1}
              </Text>
              
              <View style={styles.dataRow}>
                <Text style={styles.label}>ID:</Text>
                <Text style={styles.value}>{formation.id}</Text>
              </View>
              
              <View style={styles.dataRow}>
                <Text style={styles.label}>Key:</Text>
                <Text style={styles.value}>{formation.key || 'null'}</Text>
              </View>
              
              <View style={styles.dataRow}>
                <Text style={styles.label}>Name Translations:</Text>
                <Text style={styles.value}>
                  {JSON.stringify(formation.name_translations, null, 2)}
                </Text>
              </View>
              
              <View style={styles.dataRow}>
                <Text style={styles.label}>Type:</Text>
                <Text style={styles.value}>{formation.type || 'null'}</Text>
              </View>
              
              <View style={styles.dataRow}>
                <Text style={styles.label}>Max Players:</Text>
                <Text style={styles.value}>{formation.max_players || 'null'}</Text>
              </View>
              
              <View style={styles.dataRow}>
                <Text style={styles.label}>Positions (raw):</Text>
                <Text style={styles.value}>
                  {JSON.stringify(formation.positions, null, 2)}
                </Text>
              </View>
              
              <View style={styles.dataRow}>
                <Text style={styles.label}>Positions Type:</Text>
                <Text style={styles.value}>
                  {typeof formation.positions} | Array: {Array.isArray(formation.positions).toString()}
                </Text>
              </View>
              
              <View style={styles.dataRow}>
                <Text style={styles.label}>Positions Length:</Text>
                <Text style={styles.value}>
                  {formation.positions?.length || 0}
                </Text>
              </View>
              
              <View style={styles.dataRow}>
                <Text style={styles.label}>Created At:</Text>
                <Text style={styles.value}>{formation.created_at}</Text>
              </View>
            </View>
          ))
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  content: {
    flex: 1,
    padding: 20,
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
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginBottom: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter-Regular',
  },
  formationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  formationTitle: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dataRow: {
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
    marginBottom: 2,
  },
  value: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#111827',
    backgroundColor: '#F9FAFB',
    padding: 8,
    borderRadius: 6,
    fontFamily: 'monospace',
  },
});