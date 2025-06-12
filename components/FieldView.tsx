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

  const getPositionColor = (pos: FormationPosition, player?: Player): string => {
    if (highlightPosition === pos.id) return '#EF4444'; // Red for highlighted
    if (player) return '#10B981'; // Green for occupied
    return '#6B7280'; // Gray for empty
  };

  return (
    <View style={styles.container}>
      <View style={[styles.field, fieldType === 'indoor' ? styles.indoor : styles.outdoor]}>
        {/* Field markings */}
        <View style={styles.fieldMarkings}>
          {/* Center circle */}
          <View style={styles.centerCircle} />
          
          {/* Goal areas */}
          <View style={[styles.goalArea, styles.topGoalArea]} />
          <View style={[styles.goalArea, styles.bottomGoalArea]} />
          
          {/* Center line */}
          <View style={styles.centerLine} />
          
          {/* Corner arcs */}
          <View style={[styles.cornerArc, styles.topLeftCorner]} />
          <View style={[styles.cornerArc, styles.topRightCorner]} />
          <View style={[styles.cornerArc, styles.bottomLeftCorner]} />
          <View style={[styles.cornerArc, styles.bottomRightCorner]} />
        </View>

        {/* Position dots */}
        {positions.map(pos => {
          const player = getPlayerInPosition(pos);
          const highlighted = highlightPosition === pos.id;
          const dotColor = getPositionColor(pos, player);
          
          return (
            <TouchableOpacity
              key={pos.id}
              style={[
                styles.positionDot,
                {
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                  backgroundColor: dotColor,
                },
                highlighted && styles.highlightedDot,
              ]}
              onPress={() => onPositionPress && onPositionPress(pos)}
              activeOpacity={0.7}
            >
              {player && (
                <Text style={styles.playerNumber}>
                  {player.number || '?'}
                </Text>
              )}
              
              {/* Position label */}
              <View style={[
                styles.positionLabel,
                highlighted && styles.highlightedLabel
              ]}>
                <Text style={[
                  styles.positionText,
                  highlighted && styles.highlightedText
                ]}>
                  {pos.dutch_name}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
      
      {/* Field legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
          <Text style={styles.legendText}>Bezet</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#6B7280' }]} />
          <Text style={styles.legendText}>Leeg</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
          <Text style={styles.legendText}>Geselecteerd</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: 16,
  },
  field: {
    width: 280,
    height: 180,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  indoor: {
    backgroundColor: '#DBEAFE',
  },
  outdoor: {
    backgroundColor: '#16A34A',
  },
  fieldMarkings: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  centerCircle: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    transform: [{ translateX: -20 }, { translateY: -20 }],
  },
  centerLine: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    transform: [{ translateY: -0.5 }],
  },
  goalArea: {
    position: 'absolute',
    left: '35%',
    width: '30%',
    height: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  topGoalArea: {
    top: 0,
    borderTopWidth: 0,
  },
  bottomGoalArea: {
    bottom: 0,
    borderBottomWidth: 0,
  },
  cornerArc: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  topLeftCorner: {
    top: 0,
    left: 0,
    borderTopWidth: 0,
    borderLeftWidth: 0,
  },
  topRightCorner: {
    top: 0,
    right: 0,
    borderTopWidth: 0,
    borderRightWidth: 0,
  },
  bottomLeftCorner: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
  },
  bottomRightCorner: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 0,
    borderRightWidth: 0,
  },
  positionDot: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ translateX: -10 }, { translateY: -10 }],
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  highlightedDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    transform: [{ translateX: -12 }, { translateY: -12 }],
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 5,
  },
  playerNumber: {
    fontSize: 8,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  positionLabel: {
    position: 'absolute',
    top: 24,
    left: '50%',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    transform: [{ translateX: -50 }],
    minWidth: 40,
    alignItems: 'center',
  },
  highlightedLabel: {
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    top: 28,
  },
  positionText: {
    fontSize: 8,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  highlightedText: {
    color: '#FFFFFF',
  },
  legend: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  legendText: {
    fontSize: 10,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
});