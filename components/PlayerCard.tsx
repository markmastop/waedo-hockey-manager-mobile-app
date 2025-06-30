/** Small card component displaying player details. */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Star } from 'lucide-react-native';
import { Player } from '@/types/database';
import { getPositionColor, getPositionDisplayName } from '@/lib/playerPositions';

interface Props {
  player: Player;
  onPress?: () => void;
  showStar?: boolean;
  selected?: boolean;
}

export function PlayerCard({ player, onPress, showStar, selected }: Props) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.card,
        selected && styles.selected,
      ]}
      accessibilityLabel={`Speler ${player.name}`}
    >
      <View style={styles.numberContainer}>
        <Text style={styles.numberText}>#{player.number || '?'}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name}>{player.name || 'Onbekende speler'}</Text>
        <View style={styles.positionContainer}>
          <View style={[
            styles.positionBadge,
            { backgroundColor: getPositionColor(player.position) },
          ]}>
            <Text style={styles.positionText}>
              {getPositionDisplayName(player.position)}
            </Text>
          </View>
        </View>
      </View>
      {showStar && (
        <View style={styles.starContainer} accessibilityLabel="Basis speler">
          <Star size={14} color="#16A34A" fill="#16A34A" />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    marginBottom: 6,
  },
  selected: {
    backgroundColor: '#F0FDF4',
    borderColor: '#16A34A',
  },
  numberContainer: {
    width: 32,
    height: 32,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  numberText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#16A34A',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 3,
  },
  positionContainer: {
    flexDirection: 'row',
  },
  positionBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  positionText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  starContainer: {
    marginLeft: 6,
  },
});
