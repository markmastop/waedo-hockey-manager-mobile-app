import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Shield } from 'lucide-react-native';

interface TimelineProps {
  timelineEvents: any[];
  currentTime: number;
  formation: any;
  formatTime: (time: number) => string;
}

const Timeline: React.FC<TimelineProps> = ({
  timelineEvents,
  currentTime,
  formation,
  formatTime,
}) => {
  return (
    <View style={styles.fullTimelineSection}>
      <Text style={styles.sectionTitle}>Volledige Timeline</Text>
      <View style={styles.timelineList}>
        {timelineEvents.map((event, index) => (
          <View 
            key={index} 
            style={[
              styles.timelineEvent,
              event.time <= currentTime && styles.pastEvent,
              event.time > currentTime && event.time <= currentTime + 120 && styles.upcomingEvent
            ]}
          >
            <View style={styles.timelineEventTime}>
              <Text style={[
                styles.timelineEventTimeText,
                event.time <= currentTime && styles.pastEventText
              ]}>
                {formatTime(event.time)}
              </Text>
              <Text style={[
                styles.timelineEventQuarter,
                event.time <= currentTime && styles.pastEventText
              ]}>
                Q{event.quarter}
              </Text>
            </View>
            
            <View style={styles.timelineEventContent}>
              <View style={styles.timelineEventHeader}>
                <Text style={[
                  styles.timelineEventPosition,
                  event.time <= currentTime && styles.pastEventText
                ]}>
                  {formation?.positions.find(pos => pos.name === event.position)?.label_translations?.nl || event.position}
                </Text>
                <View style={[
                  styles.timelineEventType,
                  { backgroundColor: event.isSubstitution ? '#F59E0B' : '#10B981' }
                ]}>
                  <Text style={styles.timelineEventTypeText}>
                    {event.isSubstitution ? 'Wissel' : 'Start'}
                  </Text>
                </View>
              </View>
              
              <View style={styles.timelineEventPlayer}>
                <View style={[styles.playerNumber, { backgroundColor: '#F59E0B' }]}>
                  <Text style={styles.playerNumberText}>{event.player.number}</Text>
                </View>
                <Text style={[
                  styles.timelineEventPlayerName,
                  event.time <= currentTime && styles.pastEventText
                ]}>
                  {event.player.name}
                </Text>
                {event.player.isGoalkeeper && <Shield size={12} color="#EF4444" />}
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  fullTimelineSection: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  timelineList: {
    gap: 8,
  },
  timelineEvent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  pastEvent: {
    backgroundColor: '#F8FAFC',
  },
  upcomingEvent: {
    backgroundColor: '#FEF3C7',
  },
  timelineEventTime: {
    marginRight: 16,
  },
  timelineEventTimeText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  timelineEventQuarter: {
    fontSize: 12,
    color: '#4B5563',
    marginTop: 2,
  },
  timelineEventContent: {
    flex: 1,
  },
  timelineEventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  timelineEventPosition: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  timelineEventType: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  timelineEventTypeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#fff',
  },
  timelineEventPlayer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playerNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerNumberText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  timelineEventPlayerName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    flex: 1,
  },
  pastEventText: {
    color: '#6B7280',
  },
});

export default Timeline;
