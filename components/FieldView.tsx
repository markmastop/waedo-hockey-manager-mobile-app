import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Player, FormationPosition } from '@/types/database';

interface Props {
  positions: FormationPosition[];
  lineup: Player[];
  onPositionPress?: (position: FormationPosition) => void;
  highlightPosition?: string | null;
  fieldType?: 'indoor' | 'outdoor';
}

export default function FieldView({
  positions,
  lineup,
  onPositionPress,
  highlightPosition,
  fieldType = 'outdoor',
}: Props) {
  const getPlayerInPosition = (pos: FormationPosition): Player | undefined => {
    return lineup.find(p => p.position === pos.dutch_name);
  };

  const getPlayerInitial = (player: Player): string => {
    return player.name.charAt(0).toUpperCase();
  };

  return (
    <View style={[styles.field, fieldType === 'indoor' ? styles.indoor : styles.outdoor]}>
      {positions.map(pos => {
        const player = getPlayerInPosition(pos);
        const highlighted = highlightPosition === pos.id;
        return (
          <TouchableOpacity
            key={pos.id}
            style={[
              styles.marker,
              {
                left: `${pos.x}%`,
                top: `${pos.y}%`,
              },
              highlighted && styles.highlighted,
            ]}
            onPress={() => onPositionPress && onPositionPress(pos)}
          >
            <View style={[styles.circle, player ? styles.filled : styles.empty]}>
              {player ? (
                <>
                  <Text style={styles.initial}>{getPlayerInitial(player)}</Text>
                  <View style={styles.numberBadge}>
                    <Text style={styles.number}>{player.number}</Text>
                  </View>
                </>
              ) : (
                <Text style={styles.plus}>+</Text>
              )}
            </View>
            <Text style={styles.label}>{pos.dutch_name}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    width: '100%',
    aspectRatio: 0.6,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 20,
  },
  indoor: {
    backgroundColor: '#DBEAFE',
  },
  outdoor: {
    backgroundColor: '#DCFCE7',
  },
  marker: {
    position: 'absolute',
    alignItems: 'center',
    transform: [{ translateX: -20 }, { translateY: -20 }],
  },
  highlighted: {
    zIndex: 2,
    transform: [{ translateX: -20 }, { translateY: -20 }, { scale: 1.1 }],
  },
  circle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filled: {
    backgroundColor: '#059669',
  },
  empty: {
    borderWidth: 2,
    borderColor: '#86EFAC',
    backgroundColor: '#FFFFFF',
  },
  initial: {
    color: '#FFFFFF',
    fontFamily: 'Inter-Bold',
    fontSize: 18,
  },
  plus: {
    color: '#059669',
    fontFamily: 'Inter-Bold',
    fontSize: 20,
  },
  numberBadge: {
    position: 'absolute',
    right: -6,
    bottom: -6,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  number: {
    fontSize: 10,
    fontFamily: 'Inter-Bold',
    color: '#059669',
  },
  label: {
    marginTop: 2,
    fontSize: 10,
    fontFamily: 'Inter-Medium',
    color: '#111827',
    textAlign: 'center',
  },
});
