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

  // Adjust Y position to prevent goalkeeper from falling off the field
  const getAdjustedPosition = (pos: FormationPosition) => {
    let adjustedY = pos.y;
    
    // Ensure positions stay within field bounds (5% margin from edges)
    if (adjustedY < 8) adjustedY = 8;
    if (adjustedY > 92) adjustedY = 92;
    
    return {
      x: pos.x,
      y: adjustedY
    };
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
          const adjustedPos = getAdjustedPosition(pos);
          
          return (
            <TouchableOpacity
              key={pos.id}
              style={[
                styles.positionDot,
                {
                  left: `${adjustedPos.x}%`,
                  top: `${adjustedPos.y}%`,
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
              
              {/* Position label - use Dutch name from formation */}
              <View style={[
                styles.positionLabel,
                highlighted && styles.highlightedLabel
              ]}>
                <Text style={[
                  styles.positionText,
                  highlighted && styles.highlightedText
                ]}>
                  {pos.dutch_name || pos.name}
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
    width: 300,
    height: 200,
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
    borderRadius: 10,
  },
  topGoalArea: {
    top: 0,
    borderTopWidth: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  bottomGoalArea: {
    bottom: 0,
    borderBottomWidth: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
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
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ translateX: -11 }, { translateY: -11 }],
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  highlightedDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    transform: [{ translateX: -13 }, { translateY: -13 }],
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 5,
  },
  playerNumber: {
    fontSize: 9,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  positionLabel: {
    position: 'absolute',
    top: 26,
    left: '50%',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    transform: [{ translateX: -50 }],
    minWidth: 50,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  highlightedLabel: {
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    top: 30,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  positionText: {
    fontSize: 8,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  highlightedText: {
    color: '#FFFFFF',
    fontSize: 9,
  },
  legend: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  legendText: {
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    color: '#374151',
  },
});