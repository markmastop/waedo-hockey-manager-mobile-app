import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Clock, Grid3x3, Filter } from 'lucide-react-native';

interface ControlsProps {
  viewMode: 'timeline' | 'grid';
  setViewMode: (mode: 'timeline' | 'grid') => void;
  onFilterPress: () => void;
}

const Controls: React.FC<ControlsProps> = ({
  viewMode,
  setViewMode,
  onFilterPress,
}) => {
  return (
    <View style={styles.controls}>
      <View style={styles.viewModeToggle}>
        <TouchableOpacity
          style={[styles.toggleButton, viewMode === 'timeline' && styles.activeToggle]}
          onPress={() => setViewMode('timeline')}
        >
          <Clock size={16} color={viewMode === 'timeline' ? '#FFFFFF' : '#6B7280'} />
          <Text style={[styles.toggleText, viewMode === 'timeline' && styles.activeToggleText]}>
            Live
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.toggleButton, viewMode === 'grid' && styles.activeToggle]}
          onPress={() => setViewMode('grid')}
        >
          <Grid3x3 size={16} color={viewMode === 'grid' ? '#FFFFFF' : '#6B7280'} />
          <Text style={[styles.toggleText, viewMode === 'grid' && styles.activeToggleText]}>
            Grid
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.filterButton} onPress={onFilterPress}>
        <Filter size={16} color="#6B7280" />
        <Text style={styles.filterText}>Filter</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    marginBottom: 16,
  },
  viewModeToggle: {
    flexDirection: 'row',
    gap: 12,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  activeToggle: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  toggleText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#6B7280',
  },
  activeToggleText: {
    color: '#FFFFFF',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#6B7280',
  },
});

export default Controls;
