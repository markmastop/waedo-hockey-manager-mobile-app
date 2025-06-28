import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Users, Clock, Target } from 'lucide-react-native';

interface StatsBarProps {
  activePlayers: number;
  upcomingSubstitutions: number;
  currentQuarter: number;
}

const StatsBar: React.FC<StatsBarProps> = ({
  activePlayers,
  upcomingSubstitutions,
  currentQuarter,
}) => {
  return (
    <View style={styles.statsBar}>
      <View style={styles.statItem}>
        <Users size={16} color="#10B981" />
        <Text style={styles.statLabel}>Actieve Spelers</Text>
        <Text style={styles.statValue}>{activePlayers}</Text>
      </View>
      
      <View style={styles.statItem}>
        <Clock size={16} color="#F59E0B" />
        <Text style={styles.statLabel}>Aankomende Wissels</Text>
        <Text style={styles.statValue}>{upcomingSubstitutions}</Text>
      </View>
      
      <View style={styles.statItem}>
        <Target size={16} color="#8B5CF6" />
        <Text style={styles.statLabel}>Kwart</Text>
        <Text style={styles.statValue}>{currentQuarter}/4</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginTop: 2,
  },
});

export default StatsBar;
