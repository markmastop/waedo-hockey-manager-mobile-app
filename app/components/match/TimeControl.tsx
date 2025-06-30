/** Controls for running match timer and scores. */
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
          
          <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'center' }}>
            <TouchableOpacity 
              style={[styles.controlButton, styles.playButton]}
              onPress={() => setIsPlaying(!isPlaying)}
            >
              {isPlaying ? (
                <Pause size={24} color="#FFFFFF" />
              ) : (
                <Play size={24} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity 
            style={[styles.controlButton, { zIndex: 0 }]}
            onPress={() => setCurrentTime(Math.min(60 * 60, currentTime + 60))}
          >
            <ChevronRight size={16} color="#6B7280" />
          </TouchableOpacity>
        </View>
        <View style={[styles.scoreControls, { justifyContent: 'flex-end' }]}>
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
          <Text style={[styles.scoreText, { marginLeft: 8 }]}>{away_score}</Text>
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
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
    width: '100%', // Take full width
  },
  scoreControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  timerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  controlButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    zIndex: 1,
  },
  playButton: {
    backgroundColor: '#10B981',
    padding: 12,
    borderRadius: 12,
    zIndex: 2,
  },
  scoreButton: {
    backgroundColor: '#F3F4F6',
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
