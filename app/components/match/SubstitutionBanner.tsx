import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ArrowUpDown } from 'lucide-react-native';

interface SubstitutionBannerProps {
  isSubstituting: boolean;
  selectedPosition: string | null;
  getPositionName: (position: string) => string;
  onDismiss: () => void;
}

export default function SubstitutionBanner({
  isSubstituting,
  selectedPosition,
  getPositionName,
  onDismiss,
}: SubstitutionBannerProps) {
  return isSubstituting ? (
    <View style={styles.substitutionBanner}>
      <ArrowUpDown size={14} color="#16A34A" />
      <Text style={styles.substitutionText}>
        {selectedPosition 
          ? `Selecteer een speler voor positie ${getPositionName(selectedPosition)}`
          : 'Selecteer een positie of speler om te wisselen'
        }
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
