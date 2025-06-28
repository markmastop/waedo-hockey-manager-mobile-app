import React from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { Play, Pause, ChevronLeft, ChevronRight, RefreshCw, Plus, Minus } from 'lucide-react-native';

interface TimeControlProps {
  currentTime: number;
  isPlaying: boolean;
  setCurrentTime: (time: number) => void;
  setIsPlaying: (playing: boolean) => void;
  home_score: number;
  away_score: number;
  onHomeScoreUp: () => void;
  onHomeScoreDown: () => void;
  onAwayScoreUp: () => void;
  onAwayScoreDown: () => void;
}

const TimeControl: React.FC<TimeControlProps> = ({
  currentTime,
  isPlaying,
  setCurrentTime,
  setIsPlaying,
  home_score,
  away_score,
  onHomeScoreUp,
  onHomeScoreDown,
  onAwayScoreUp,
  onAwayScoreDown,
}) => {
  return (
    <View style={styles.timeControl}>
      <View style={styles.playControls}>
        <View style={styles.scoreControls}>
          <TouchableOpacity 
            style={[styles.controlButton, styles.scoreButton]}
            onPress={() => {
              onHomeScoreUp();
              // Update the local state to reflect the change immediately
              // This assumes the parent component updates the prop correctly
            }}
          >
            <Plus size={16} color="#6B7280" />
          </TouchableOpacity>
          <Text style={styles.scoreText}>{home_score}</Text>
          <TouchableOpacity 
            style={[styles.controlButton, styles.scoreButton]}
            onPress={() => {
              onHomeScoreDown();
              // Update the local state to reflect the change immediately
              // This assumes the parent component updates the prop correctly
            }}
          >
            <Minus size={16} color="#6B7280" />
          </TouchableOpacity>
        </View>
        <View style={styles.timerControls}>
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
            onPress={() => setCurrentTime(Math.min(60 * 60, currentTime + 60))}
          >
            <ChevronRight size={16} color="#6B7280" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.controlButton, styles.resetButton]}
            onPress={() => setCurrentTime(0)}
          >
            <RefreshCw size={16} color="#6B7280" />
          </TouchableOpacity>
        </View>
        <View style={styles.scoreControls}>
          <TouchableOpacity 
            style={[styles.controlButton, styles.scoreButton]}
            onPress={() => {
              onAwayScoreDown();
              // Update the local state to reflect the change immediately
              // This assumes the parent component updates the prop correctly
            }}
          >
            <Minus size={16} color="#6B7280" />
          </TouchableOpacity>
          <Text style={styles.scoreText}>{away_score}</Text>
          <TouchableOpacity 
            style={[styles.controlButton, styles.scoreButton]}
            onPress={() => {
              onAwayScoreUp();
              // Update the local state to reflect the change immediately
              // This assumes the parent component updates the prop correctly
            }}
          >
            <Plus size={16} color="#6B7280" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  timeControl: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  playControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  scoreControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  controlButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  scoreButton: {
    backgroundColor: '#F3F4F6',
  },
  playButton: {
    backgroundColor: '#10B981',
  },
  resetButton: {
    backgroundColor: '#F3F4F6',
  },
  scoreText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  }
});

export default TimeControl;
