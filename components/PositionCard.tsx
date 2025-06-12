import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Clock, ArrowUpDown, Target, AlertTriangle, User } from 'lucide-react-native';
import { Player, PlayerStats, FormationPosition } from '@/types/database';
import { getPositionColor } from '@/lib/playerPositions';

interface Props {
  position: FormationPosition;
  player?: Player | null;
  stats?: PlayerStats;
  isSelected?: boolean;
  isSubstituting?: boolean;
  onPress?: () => void;
}

export function PositionCard({
  position,
  player,
  stats,
  isSelected,
  isSubstituting,
  onPress,
}: Props) {
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getCardStyle = () => {
    if (isSelected) return styles.selectedCard;
    if (isSubstituting) return styles.substitutingCard;
    if (player) return styles.occupiedCard;
    return styles.emptyCard;
  };

  return (
    <TouchableOpacity
      style={[styles.card, getCardStyle()]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.header}>
        <View style={styles.positionInfo}>
          <View style={[
            styles.positionBadge,
            { backgroundColor: getPositionColor(position.dutch_name) }
          ]}>
            <Text style={styles.positionOrder}>{position.order}</Text>
          </View>
          
          <View style={styles.positionDetails}>
            <Text style={styles.positionName}>{position.dutch_name}</Text>
            <Text style={styles.positionSubName}>{position.name}</Text>
          </View>
        </View>

        {player && (
          <View style={styles.playerInfo}>
            <Text style={styles.playerNumber}>#{player.number || '?'}</Text>
          </View>
        )}
      </View>

      {player ? (
        <View style={styles.playerSection}>
          <Text style={styles.playerName}>{player.name}</Text>
          
          {stats && (
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Clock size={12} color="#6B7280" />
                <Text style={styles.statText}>
                  {formatTime(stats.timeOnField)}
                </Text>
              </View>
              
              <View style={styles.statItem}>
                <ArrowUpDown size={12} color="#6B7280" />
                <Text style={styles.statText}>
                  {stats.substitutions} wissels
                </Text>
              </View>
              
              {stats.goals !== undefined && stats.goals > 0 && (
                <View style={styles.statItem}>
                  <Target size={12} color="#10B981" />
                  <Text style={[styles.statText, { color: '#10B981' }]}>
                    {stats.goals}
                  </Text>
                </View>
              )}
              
              {stats.cards !== undefined && stats.cards > 0 && (
                <View style={styles.statItem}>
                  <AlertTriangle size={12} color="#F59E0B" />
                  <Text style={[styles.statText, { color: '#F59E0B' }]}>
                    {stats.cards}
                  </Text>
                </View>
              )}
            </View>
          )}

          {stats && (
            <View style={styles.quarterIndicators}>
              {[1, 2, 3, 4].map(quarter => (
                <View
                  key={quarter}
                  style={[
                    styles.quarterDot,
                    stats.quartersPlayed.includes(quarter) && styles.quarterDotActive
                  ]}
                />
              ))}
            </View>
          )}
        </View>
      ) : (
        <View style={styles.emptyPlayerSection}>
          <User size={24} color="#9CA3AF" />
          <Text style={styles.emptyPlayerText}>Geen speler toegewezen</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    marginBottom: 8,
  },
  selectedCard: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  substitutingCard: {
    borderColor: '#FF6B35',
    backgroundColor: '#FEF2F2',
  },
  occupiedCard: {
    borderColor: '#10B981',
    backgroundColor: '#FFFFFF',
  },
  emptyCard: {
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  positionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  positionBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  positionOrder: {
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  positionDetails: {
    flex: 1,
  },
  positionName: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 1,
  },
  positionSubName: {
    fontSize: 10,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  playerInfo: {
    alignItems: 'flex-end',
  },
  playerNumber: {
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    color: '#10B981',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  playerSection: {
    marginTop: 4,
  },
  playerName: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 6,
  },
  emptyPlayerSection: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  emptyPlayerText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  statText: {
    fontSize: 10,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  quarterIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  quarterDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E5E7EB',
  },
  quarterDotActive: {
    backgroundColor: '#10B981',
  },
});