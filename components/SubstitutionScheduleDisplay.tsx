import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Clock, ArrowUpDown, Users, ArrowRight } from 'lucide-react-native';

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
        return 'Nu';
      case 'future':
        return 'Gepland';
      default:
        return '';
    }
  };

  const renderSubstitutionDetails = (substitutions: any) => {
    if (!substitutions || typeof substitutions !== 'object') {
      return null;
    }

    return Object.entries(substitutions).map(([position, playerData]: [string, any], index) => {
      if (!playerData || typeof playerData !== 'object') {
        return (
          <View key={index} style={styles.substitutionItem}>
            <Text style={styles.positionText}>{position}:</Text>
            <Text style={styles.playerText}>Geen data</Text>
          </View>
        );
      }

      // Handle different data structures
      let playerIn = null;
      let playerOut = null;

      if (playerData.playerIn && playerData.playerOut) {
        playerIn = playerData.playerIn;
        playerOut = playerData.playerOut;
      } else if (playerData.in && playerData.out) {
        playerIn = playerData.in;
        playerOut = playerData.out;
      } else {
        // If it's just a player object, treat as substitution in
        playerIn = playerData;
      }

      return (
        <View key={index} style={styles.substitutionItem}>
          <Text style={styles.positionText}>{position}:</Text>
          <View style={styles.substitutionDetails}>
            {playerOut && (
              <>
                <Text style={styles.playerOutText}>
                  #{playerOut.number || '?'} {playerOut.name || 'Onbekend'}
                </Text>
                <ArrowRight size={12} color="#6B7280" />
              </>
            )}
            {playerIn && (
              <Text style={styles.playerInText}>
                #{playerIn.number || '?'} {playerIn.name || 'Onbekend'}
              </Text>
            )}
          </View>
        </View>
      );
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ArrowUpDown size={18} color="#8B5CF6" />
        <Text style={styles.title}>Wisselschema Timeline</Text>
        <View style={styles.currentTime}>
          <Clock size={14} color="#6B7280" />
          <Text style={styles.currentTimeText}>{formatTime(currentTime)}</Text>
        </View>
      </View>

      {/* Timeline Progress Bar */}
      <View style={styles.timelineContainer}>
        <View style={styles.timelineBar}>
          {timeKeys.map((timeKey, index) => {
            const scheduleTime = Number(timeKey);
            const status = getTimeStatus(timeKey);
            const statusColor = getStatusColor(status);
            const progress = Math.min(currentTime / scheduleTime, 1);
            
            return (
              <View key={timeKey} style={styles.timelinePoint}>
                <View style={[styles.timelineDot, { backgroundColor: statusColor }]} />
                <Text style={[styles.timelineLabel, { color: statusColor }]}>
                  {formatTime(scheduleTime)}
                </Text>
              </View>
            );
          })}
        </View>
        <View style={styles.currentTimeIndicator} style={{
          left: `${Math.min((currentTime / (Number(timeKeys[timeKeys.length - 1]) || 1)) * 100, 100)}%`
        }}>
          <View style={styles.currentTimeLine} />
          <Text style={styles.currentTimeLabel}>Nu</Text>
        </View>
      </View>

      <ScrollView style={styles.scheduleList} showsVerticalScrollIndicator={false}>
        {timeKeys.map((timeKey, index) => {
          const scheduleTime = Number(timeKey);
          const status = getTimeStatus(timeKey);
          const statusColor = getStatusColor(status);
          const substitutions = substitutionSchedule[timeKey];
          
          return (
            <View key={timeKey} style={[
              styles.scheduleItem,
              status === 'upcoming' && styles.upcomingItem,
              status === 'completed' && styles.completedItem
            ]}>
              <View style={styles.timeContainer}>
                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                <Text style={[styles.timeText, { color: statusColor }]}>
                  {formatTime(scheduleTime)}
                </Text>
                <Text style={[styles.statusText, { color: statusColor }]}>
                  {getStatusText(status)}
                </Text>
                {status === 'upcoming' && (
                  <View style={styles.urgentBadge}>
                    <Text style={styles.urgentText}>!</Text>
                  </View>
                )}
              </View>
              
              <View style={styles.substitutionsContainer}>
                <View style={styles.substitutionsHeader}>
                  <Users size={14} color="#6B7280" />
                  <Text style={styles.substitutionsTitle}>
                    Wissels ({Object.keys(substitutions || {}).length})
                  </Text>
                </View>
                
                {/* Render actual substitution details */}
                <View style={styles.substitutionsList}>
                  {renderSubstitutionDetails(substitutions)}
                </View>

                {/* Debug: Show raw keys */}
                <View style={styles.debugContainer}>
                  <Text style={styles.debugTitle}>Debug - Schema keys:</Text>
                  <View style={styles.keysContainer}>
                    {Object.keys(substitutions || {}).map((key, keyIndex) => (
                      <Text key={keyIndex} style={styles.keyText}>• {key}</Text>
                    ))}
                  </View>
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
  timelineContainer: {
    position: 'relative',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
  },
  timelineBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 40,
  },
  timelinePoint: {
    alignItems: 'center',
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginBottom: 4,
  },
  timelineLabel: {
    fontSize: 10,
    fontFamily: 'Inter-SemiBold',
  },
  currentTimeIndicator: {
    position: 'absolute',
    top: 12,
    alignItems: 'center',
  },
  currentTimeLine: {
    width: 2,
    height: 20,
    backgroundColor: '#EF4444',
  },
  currentTimeLabel: {
    fontSize: 8,
    fontFamily: 'Inter-Bold',
    color: '#EF4444',
    marginTop: 2,
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
    maxHeight: 400,
  },
  scheduleItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  upcomingItem: {
    backgroundColor: '#FFFBEB',
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  completedItem: {
    backgroundColor: '#F0FDF4',
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
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
  urgentBadge: {
    backgroundColor: '#F59E0B',
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 'auto',
  },
  urgentText: {
    fontSize: 10,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  substitutionsContainer: {
    marginLeft: 16,
  },
  substitutionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  substitutionsTitle: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
  },
  substitutionsList: {
    gap: 6,
    marginBottom: 8,
  },
  substitutionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  positionText: {
    fontSize: 11,
    fontFamily: 'Inter-SemiBold',
    color: '#8B5CF6',
    minWidth: 60,
  },
  substitutionDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  playerOutText: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: '#EF4444',
    textDecorationLine: 'line-through',
  },
  playerInText: {
    fontSize: 11,
    fontFamily: 'Inter-SemiBold',
    color: '#10B981',
  },
  playerText: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  debugContainer: {
    backgroundColor: '#F3F4F6',
    padding: 8,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#6B7280',
  },
  debugTitle: {
    fontSize: 10,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
    marginBottom: 4,
  },
  keysContainer: {
    gap: 2,
  },
  keyText: {
    fontSize: 9,
    fontFamily: 'Inter-Regular',
    color: '#374151',
  },
});