import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Clock } from 'lucide-react-native';

interface TimeDisplayProps {
  currentTime: number;
  currentQuarter: number;
  homeScore: number;
  awayScore: number;
  formatTime: (time: number) => string;
}

export default function TimeDisplay({
  currentTime,
  currentQuarter,
  homeScore,
  awayScore,
  formatTime,
}: TimeDisplayProps) {
  return (
    <View style={styles.timeDisplayContainer}>
      <View style={styles.timeInfo}>
        <Clock size={16} color="#6B7280" />
        <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
        <Text style={styles.quarterText}>Kwart {currentQuarter}</Text>
      </View>
      <View style={styles.scoreInfo}>
        <Text style={styles.scoreText}>{homeScore} - {awayScore}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  timeDisplayContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  timeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeText: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  quarterText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  scoreInfo: {
    alignItems: 'flex-end',
  },
  scoreText: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
});
