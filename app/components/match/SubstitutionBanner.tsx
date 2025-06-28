import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ArrowUpDown } from 'lucide-react-native';
import { Player } from '@/types/database';

interface SubstitutionBannerProps {
  isSubstituting: boolean;
  selectedPosition: string | null;
  selectedPlayer: Player | null;
  getPositionName: (position: string) => string;
  onDismiss: () => void;
}

export default function SubstitutionBanner({
  isSubstituting,
  selectedPosition,
  selectedPlayer,
  getPositionName,
  onDismiss,
}: SubstitutionBannerProps) {
  const getBannerText = () => {
    if (selectedPlayer && selectedPosition) {
      return `Wissel ${selectedPlayer.name} (#${selectedPlayer.number}) uit positie ${getPositionName(selectedPosition)}`;
    } else if (selectedPosition) {
      return `Selecteer een speler voor positie ${getPositionName(selectedPosition)}`;
    } else if (selectedPlayer) {
      return `Selecteer een positie voor ${selectedPlayer.name} (#${selectedPlayer.number})`;
    } else {
      return 'Selecteer een positie of speler om te wisselen';
    }
  };

  return isSubstituting ? (
    <View style={styles.substitutionBanner}>
      <ArrowUpDown size={14} color="#16A34A" />
      <Text style={styles.substitutionText}>
        {getBannerText()}
      </Text>
      <TouchableOpacity onPress={onDismiss}>
        <Text style={styles.cancelText}>Annuleren</Text>
      </TouchableOpacity>
    </View>
  ) : null;
}

const styles = StyleSheet.create({
  substitutionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  substitutionText: {
    flex: 1,
    fontSize: 13,
    color: '#16A34A',
    fontFamily: 'Inter-Medium',
  },
  cancelText: {
    fontSize: 13,
    color: '#DC2626',
    fontFamily: 'Inter-SemiBold',
  },
});
