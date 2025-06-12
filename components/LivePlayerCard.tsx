import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Star, Clock, ArrowUpDown, Target, AlertTriangle } from 'lucide-react-native';
import { Player, PlayerStats } from '@/types/database';
import { getPositionColor, getPositionDisplayName } from '@/lib/playerPositions';

interface Props {
  player: Player;
  stats?: PlayerStats;
  isOnField: boolean;
  isSelected?: boolean;
  isSubstituting?: boolean;
  onPress?: () => void;
  onQuickSub?: () => void;
  showStats?: boolean;
}

export function LivePlayerCard({
  player,
  stats,
  isOnField,
  isSelected,
  isSubstituting,
  onPress,
  onQuickSub,
  showStats = true,
}: Props) {
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getPlayerStatus = () => {
    if (isOnField) return 'Op het veld';
    return 'Op de bank';
  };

  const getCardStyle = () => {
    if (isSelected) return styles.selectedCard;
    if (isSubstituting) return styles.substitutingCard;
    if (isOnField) return styles.onFieldCard;
    return styles.benchCard;
  };

  return (
    <TouchableOpacity
      style={[styles.card, getCardStyle()]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.header}>
        <View style={styles.playerInfo}>
          <View style={[
            styles.numberBadge,
            { backgroundColor: getPositionColor(player.position) }
          ]}>
            <Text style={styles.numberText}>#{player.number || '?'}</Text>
          </View>
          
          <View style={styles.nameContainer}>
            <Text style={styles.playerName}>{player.name}</Text>
            <View style={styles.positionContainer}>
              <Text style={[
                styles.positionText,
                { color: getPositionColor(player.position) }
              ]}>
                {getPositionDisplayName(player.position)}
              </Text>
              {isOnField && (
                <Star size={12} color="#10B981" fill="#10B981" />
              )}
            </View>
          </View>
        </View>

        <View style={styles.statusContainer}>
          <Text style={[
            styles.statusText,
            { color: isOnField ? '#10B981' : '#6B7280' }
          ]}>
            {getPlayerStatus()}
          </Text>
          
          {isSubstituting && onQuickSub && (
            <TouchableOpacity style={styles.quickSubButton} onPress={onQuickSub}>
              <ArrowUpDown size={12} color="#FF6B35" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {showStats && stats && (
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
                {stats.goals} goals
              </Text>
            </View>
          )}
          
          {stats.cards !== undefined && stats.cards > 0 && (
            <View style={styles.statItem}>
              <AlertTriangle size={12} color="#F59E0B" />
              <Text style={[styles.statText, { color: '#F59E0B' }]}>
                {stats.cards} kaarten
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
  onFieldCard: {
    borderColor: '#10B981',
    backgroundColor: '#FFFFFF',
  },
  benchCard: {
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  playerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  numberBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  numberText: {
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  nameContainer: {
    flex: 1,
  },
  playerName: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 2,
  },
  positionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  positionText: {
    fontSize: 10,
    fontFamily: 'Inter-Medium',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusContainer: {
    alignItems: 'flex-end',
    gap: 4,
  },
  statusText: {
    fontSize: 10,
    fontFamily: 'Inter-SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  quickSubButton: {
    backgroundColor: '#FEF2F2',
    padding: 4,
    borderRadius: 4,
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