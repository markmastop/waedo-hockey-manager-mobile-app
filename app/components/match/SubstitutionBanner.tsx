import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ArrowUpDown, Users, Target } from 'lucide-react-native';
import { Player } from '@/types/database';

interface SubstitutionBannerProps {
  isSubstituting: boolean;
  selectedPosition: string | null;
  selectedPlayer: Player | null;
  getPositionName: (position: string) => string;
  onDismiss: () => void;
  onSubstitute?: () => void;
  onGoal?: (player: Player) => void;
  reservePlayersCount?: number;
}

export default function SubstitutionBanner({
  isSubstituting,
  selectedPosition,
  selectedPlayer,
  getPositionName,
  onDismiss,
  onSubstitute,
  onGoal,
  reservePlayersCount = 0,
}: SubstitutionBannerProps) {
  const getBannerText = () => {
    if (selectedPlayer && selectedPosition) {
      return `Wissel ${selectedPlayer.name} (#${selectedPlayer.number}) uit positie ${getPositionName(selectedPosition)}`;
    } else if (selectedPosition) {
      return `Selecteer een speler voor positie ${getPositionName(selectedPosition)}`;
    } else if (selectedPlayer) {
      return `${selectedPlayer.name} (#${selectedPlayer.number}) geselecteerd`;
    } else {
      return 'Selecteer een positie of speler om te wisselen';
    }
  };

  return isSubstituting || selectedPlayer ? (
    <View style={styles.substitutionBanner}>
      <View style={styles.bannerContent}>
        <ArrowUpDown size={14} color="#16A34A" />
        <Text style={styles.substitutionText}>
          {getBannerText()}
        </Text>
      </View>
      
      <View style={styles.bannerActions}>
        {selectedPlayer && !isSubstituting && (
          <>
            {reservePlayersCount > 0 && onSubstitute && (
              <TouchableOpacity style={styles.actionButton} onPress={onSubstitute}>
                <Users size={12} color="#FF6B35" />
                <Text style={styles.actionButtonText}>Wissel</Text>
              </TouchableOpacity>
            )}
            {onGoal && (
              <TouchableOpacity 
                style={[styles.actionButton, styles.goalActionButton]} 
                onPress={() => onGoal(selectedPlayer)}
              >
                <Target size={12} color="#FFFFFF" />
                <Text style={styles.goalActionButtonText}>Goal</Text>
              </TouchableOpacity>
            )}
          </>
        )}
        <TouchableOpacity onPress={onDismiss}>
          <Text style={styles.cancelText}>
            {selectedPlayer && !isSubstituting ? 'Sluiten' : 'Annuleren'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  ) : null;
}

const styles = StyleSheet.create({
  substitutionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  substitutionText: {
    flex: 1,
    fontSize: 13,
    color: '#16A34A',
    fontFamily: 'Inter-Medium',
  },
  bannerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  goalActionButton: {
    backgroundColor: '#16A34A',
  },
  actionButtonText: {
    fontSize: 11,
    fontFamily: 'Inter-SemiBold',
    color: '#FF6B35',
  },
  goalActionButtonText: {
    fontSize: 11,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  cancelText: {
    fontSize: 13,
    color: '#DC2626',
    fontFamily: 'Inter-SemiBold',
  },
});
