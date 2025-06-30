/** Toggle component to switch between match views. */
import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Clock, Eye, Users, Grid3X3 } from 'lucide-react-native';

interface ViewModeToggleProps {
  hasSubstitutionSchedule: boolean;
  viewMode: 'formation' | 'list' | 'timeline' | 'grid';
  setViewMode: React.Dispatch<React.SetStateAction<'formation' | 'list' | 'timeline' | 'grid'>>;
}

export default function ViewModeToggle({
  hasSubstitutionSchedule,
  viewMode,
  setViewMode,
}: ViewModeToggleProps) {
  const renderViewModeButton = (icon: React.ReactNode, label: string, mode: 'formation' | 'list' | 'timeline' | 'grid') => (
    <TouchableOpacity
      style={[styles.viewModeButton, viewMode === mode && styles.activeViewMode]}
      onPress={() => setViewMode(mode)}
    >
      {icon}
      <Text style={[styles.viewModeText, viewMode === mode && styles.activeViewModeText]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.viewModeContainer}>
      {hasSubstitutionSchedule && (
        renderViewModeButton(
          <Clock size={16} color={viewMode === 'timeline' ? '#FFFFFF' : '#6B7280'} />,
          'Live',
          'timeline'
        )
      )}
      
      {renderViewModeButton(
        <Eye size={16} color={viewMode === 'formation' ? '#FFFFFF' : '#6B7280'} />,
        'Veld',
        'formation'
      )}
      
      {hasSubstitutionSchedule && (
        renderViewModeButton(
          <Grid3X3 size={16} color={viewMode === 'grid' ? '#FFFFFF' : '#6B7280'} />,
          'Grid',
          'grid'
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  viewModeContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginVertical: 16,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  viewModeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  activeViewMode: {
    backgroundColor: '#16A34A',
  },
  viewModeText: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
  },
  activeViewModeText: {
    color: '#FFFFFF',
  },
});
