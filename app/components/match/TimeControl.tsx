import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { ChevronLeft, ChevronRight, Play, Pause, Target } from 'lucide-react-native';
import { Player } from '@/types/database';

interface TimeControlProps {
  currentTime: number;
  isPlaying: boolean;
  selectedPlayer: Player | null;
  setCurrentTime: (time: number) => void;
  setIsPlaying: (playing: boolean) => void;
  onGoal?: (player: Player) => void;
}

const TimeControl: React.FC<TimeControlProps> = ({
  currentTime,
  isPlaying,
  selectedPlayer,
  setCurrentTime,
  setIsPlaying,
  onGoal,
}) => {
  return (
    <View style={styles.timeControl}>
      {/* Goal Button - Only show when player is selected */}
      {selectedPlayer && onGoal && (
        <View style={styles.goalSection}>
          <TouchableOpacity 
            style={styles.goalButton}
            onPress={() => onGoal(selectedPlayer)}
          >
            <Target size={16} color="#FFFFFF" />
            <Text style={styles.goalButtonText}>
              Goal voor {selectedPlayer.name}
            </Text>
          </TouchableOpacity>
        </View>
      )}
      
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
  goalSection: {
    paddingBottom: 12,
    alignItems: 'center',
  },
  goalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16A34A',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  goalButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
});

export default TimeControl;
