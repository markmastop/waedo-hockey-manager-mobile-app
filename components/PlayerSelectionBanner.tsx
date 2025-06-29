import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Target, ArrowUpDown, X } from 'lucide-react-native';
import { Player } from '@/types/database';

interface PlayerSelectionBannerProps {
  selectedPlayer: Player | null;
  onGoal: () => void;
  onSubstitute: () => void;
  onDismiss: () => void;
}

export default function PlayerSelectionBanner({
  selectedPlayer,
  onGoal,
  onSubstitute,
  onDismiss,
}: PlayerSelectionBannerProps) {
  if (!selectedPlayer) return null;

  return (
    <View style={styles.banner}>
      <View style={styles.playerInfo}>
        <View style={styles.playerNumberBadge}>
          <Text style={styles.playerNumberText}>#{selectedPlayer.number || '?'}</Text>
        </View>
        <View style={styles.playerDetails}>
          <Text style={styles.playerName}>{selectedPlayer.name}</Text>
          <Text style={styles.playerPosition}>{selectedPlayer.position}</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.goalButton} onPress={onGoal}>
          <Target size={16} color="#FFFFFF" />
          <Text style={styles.goalButtonText}>Goal</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.substituteButton} onPress={onSubstitute}>
          <ArrowUpDown size={16} color="#FFFFFF" />
          <Text style={styles.substituteButtonText}>Wissel</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.dismissButton} onPress={onDismiss}>
          <X size={16} color="#6B7280" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#BBF7D0',
    gap: 12,
  },
  playerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  playerNumberBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#16A34A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerNumberText: {
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  playerDetails: {
    flex: 1,
  },
  playerName: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#166534',
    marginBottom: 2,
  },
  playerPosition: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: '#15803D',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  goalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16A34A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  goalButtonText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  substituteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B35',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  substituteButtonText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  dismissButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
  },
});