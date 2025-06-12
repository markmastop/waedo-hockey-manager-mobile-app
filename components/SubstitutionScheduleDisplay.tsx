import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Clock, ArrowUpDown, Users } from 'lucide-react-native';

interface Props {
  substitutionSchedule: any;
  currentTime: number;
  currentQuarter: number;
}

export function SubstitutionScheduleDisplay({ 
  substitutionSchedule, 
  currentTime, 
  currentQuarter 
}: Props) {
  if (!substitutionSchedule || Object.keys(substitutionSchedule).length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <ArrowUpDown size={24} color="#9CA3AF" />
        <Text style={styles.emptyText}>Geen wisselschema ingesteld</Text>
      </View>
    );
  }

  // Get all time keys and sort them numerically
  const timeKeys = Object.keys(substitutionSchedule)
    .filter(key => !isNaN(Number(key)))
    .sort((a, b) => Number(a) - Number(b));

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getTimeStatus = (timeKey: string) => {
    const scheduleTime = Number(timeKey);
    if (scheduleTime <= currentTime) {
      return 'completed';
    } else if (scheduleTime <= currentTime + 60) { // Within next minute
      return 'upcoming';
    }
    return 'future';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#10B981';
      case 'upcoming':
        return '#F59E0B';
      case 'future':
        return '#6B7280';
      default:
        return '#6B7280';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Uitgevoerd';
      case 'upcoming':
        return 'Binnenkort';
      case 'future':
        return 'Gepland';
      default:
        return '';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ArrowUpDown size={18} color="#8B5CF6" />
        <Text style={styles.title}>Wisselschema</Text>
        <View style={styles.currentTime}>
          <Clock size={14} color="#6B7280" />
          <Text style={styles.currentTimeText}>{formatTime(currentTime)}</Text>
        </View>
      </View>

      <ScrollView style={styles.scheduleList} showsVerticalScrollIndicator={false}>
        {timeKeys.map((timeKey) => {
          const scheduleTime = Number(timeKey);
          const status = getTimeStatus(timeKey);
          const statusColor = getStatusColor(status);
          const substitutions = substitutionSchedule[timeKey];
          
          return (
            <View key={timeKey} style={styles.scheduleItem}>
              <View style={styles.timeContainer}>
                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                <Text style={[styles.timeText, { color: statusColor }]}>
                  {formatTime(scheduleTime)}
                </Text>
                <Text style={[styles.statusText, { color: statusColor }]}>
                  {getStatusText(status)}
                </Text>
              </View>
              
              <View style={styles.substitutionsContainer}>
                <Text style={styles.substitutionsTitle}>
                  Geplande wissels ({Object.keys(substitutions || {}).length})
                </Text>
                
                {/* Show the keys of the substitution schedule for debugging */}
                <View style={styles.keysContainer}>
                  <Text style={styles.keysTitle}>Schema keys:</Text>
                  {Object.keys(substitutions || {}).map((key, index) => (
                    <View key={index} style={styles.keyItem}>
                      <Text style={styles.keyText}>• {key}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    flex: 1,
  },
  currentTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  currentTimeText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    marginTop: 8,
  },
  scheduleList: {
    maxHeight: 300,
  },
  scheduleItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  timeText: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
  },
  statusText: {
    fontSize: 10,
    fontFamily: 'Inter-SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  substitutionsContainer: {
    marginLeft: 16,
  },
  substitutionsTitle: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
    marginBottom: 6,
  },
  keysContainer: {
    backgroundColor: '#F9FAFB',
    padding: 8,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#8B5CF6',
  },
  keysTitle: {
    fontSize: 11,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
    marginBottom: 4,
  },
  keyItem: {
    marginBottom: 2,
  },
  keyText: {
    fontSize: 10,
    fontFamily: 'Inter-Regular',
    color: '#374151',
  },
});