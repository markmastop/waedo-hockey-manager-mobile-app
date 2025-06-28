import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronLeft, ChevronRight, Play, Pause } from 'lucide-react-native';

interface TimerProps {
  currentTime: number;
  setCurrentTime: (time: number) => void;
  isPlaying: boolean;
  setIsPlaying: (isPlaying: boolean) => void;
  timelineEvents: Array<{ time: number }>;
}

const Timer: React.FC<TimerProps> = ({
  currentTime,
  setCurrentTime,
  isPlaying,
  setIsPlaying,
  timelineEvents,
}) => {
  useEffect(() => {
    let interval: number | undefined;

    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentTime(Math.min(currentTime + 1, 3600));
      }, 1000);
    }

    return () => {
      if (interval !== undefined) {
        clearInterval(interval);
      }
    };
  }, [isPlaying, setCurrentTime, setIsPlaying]);

  const formatTime = useCallback((seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }, []);

  const getCurrentQuarter = useCallback((time: number) => {
    const quarters = [15 * 60, 30 * 60, 45 * 60, 60 * 60];
    return quarters.findIndex(q => time <= q) + 1;
  }, []);

  const maxTime = timelineEvents.length > 0 ? Math.max(...timelineEvents.map(e => e.time)) : 3600;
  const timelineProgress = Math.min((currentTime / maxTime) * 100, 100);

  return (
    <View style={styles.container}>
      <View style={styles.timeDisplay}>
        <Text style={styles.currentTime}>{formatTime(currentTime)}</Text>
        <Text style={styles.quarter}>Kwart {getCurrentQuarter(currentTime)}</Text>
      </View>
      
      <View style={styles.controls}>
        <TouchableOpacity 
          style={styles.controlButton}
          onPress={() => setCurrentTime(Math.max(0, currentTime - 60))}
        >
          <ChevronLeft size={16} color="#6B7280" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.controlButton, styles.playButton]}
          onPress={() => setIsPlaying(!isPlaying)}
        >
          {isPlaying ? (
            <Pause size={16} color="#FFFFFF" />
          ) : (
            <Play size={16} color="#FFFFFF" />
          )}
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.controlButton}
          onPress={() => setCurrentTime(Math.min(3600, currentTime + 60))}
        >
          <ChevronRight size={16} color="#6B7280" />
        </TouchableOpacity>
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressTrack}>
          <View 
            style={[
              styles.progressFill, 
              { width: `${timelineProgress}%` }
            ]} 
          />
          {timelineEvents.map((event, index) => (
            <View 
              key={index}
              style={[
                styles.marker,
                { left: `${(event.time / maxTime) * 100}%` },
                event.time <= currentTime && styles.pastMarker
              ]}
            />
          ))}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginBottom: 16,
  },
  timeDisplay: {
    alignItems: 'center',
    marginBottom: 12,
  },
  currentTime: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  quarter: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 12,
  },
  controlButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  playButton: {
    backgroundColor: '#3B82F6',
  },
  progressContainer: {
    width: '100%',
  },
  progressTrack: {
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    overflow: 'visible',
  },
  progressFill: {
    height: 4,
    backgroundColor: '#3B82F6',
    borderRadius: 2,
  },
  marker: {
    position: 'absolute',
    width: 4,
    height: 4,
    backgroundColor: '#3B82F6',
    borderRadius: 2,
    top: -2,
  },
  pastMarker: {
    backgroundColor: '#6B7280',
  },
});

export default Timer;
