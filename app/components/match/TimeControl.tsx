import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { ChevronLeft, ChevronRight, Play, Pause } from 'lucide-react-native';

interface TimeControlProps {
  currentTime: number;
  isPlaying: boolean;
  setCurrentTime: (time: number) => void;
  setIsPlaying: (playing: boolean) => void;
}

const TimeControl: React.FC<TimeControlProps> = ({
  currentTime,
  isPlaying,
  setCurrentTime,
  setIsPlaying,
}) => {
  return (
    <View style={styles.timeControl}>
      <View style={styles.playControls}>
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
  controlButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  playButton: {
    backgroundColor: '#10B981',
  },
});

export default TimeControl;
