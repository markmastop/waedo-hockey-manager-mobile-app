import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Star, Target } from 'lucide-react-native';
import { Player, PlayerStats, FormationPosition } from '@/types/database';
import { getPositionColor, getPositionDisplayName } from '@/lib/playerPositions';

interface CompactPlayerCardProps {
  player: Player;
  stats?: PlayerStats;
  isOnField: boolean;
  isSelected?: boolean;
  isSubstituting?: boolean;
  onPress?: () => void;
  formation?: { positions: FormationPosition[] } | null;
}

export function CompactPlayerCard({
  player,
  stats,
  isOnField,
  isSelected,
  isSubstituting,
  onPress,
  formation,
}: CompactPlayerCardProps) {
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getCardStyle = () => {
    if (isSelected) return styles.selectedPlayerCard;
    if (isSubstituting) return styles.substitutingPlayerCard;
    if (isOnField) return styles.onFieldPlayerCard;
    return styles.benchPlayerCard;
  };

  const getDutchPositionForPlayer = (player: Player): string => {
    if (!formation) {
      return getPositionDisplayName(player.position);
    }

    const formationPosition = formation.positions.find(pos => {
      const dutchName = pos.label_translations?.nl || pos.dutch_name || pos.name;
      return player.position === dutchName || 
             player.position === pos.dutch_name || 
             player.position === pos.name;
    });

    if (formationPosition) {
      return formationPosition.label_translations?.nl || formationPosition.dutch_name || formationPosition.name || player.position;
    }

    return getPositionDisplayName(player.position);
  };

  const displayPosition = getDutchPositionForPlayer(player);

  return (
    <TouchableOpacity
      style={[styles.compactPlayerCard, getCardStyle()]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.playerRow}>
        <View style={[
          styles.playerNumberBadge,
          { backgroundColor: getPositionColor(player.position) }
        ]}>
          <Text style={styles.playerNumberText}>#{player.number || '?'}</Text>
        </View>
        
        <View style={styles.playerInfo}>
          <Text style={styles.playerName} numberOfLines={1}>{player.name}</Text>
          <View style={styles.playerMeta}>
            <Text style={[
              styles.positionText,
              { color: getPositionColor(player.position) }
            ]}>
              {displayPosition}
            </Text>
            {stats && stats.timeOnField > 0 && (
              <>
                <Text style={styles.metaSeparator}>•</Text>
                <Text style={styles.timeText}>{formatTime(stats.timeOnField)}</Text>
              </>
            )}
            {stats && stats.goals && stats.goals > 0 && (
              <>
                <Text style={styles.metaSeparator}>•</Text>
                <View style={styles.statBadge}>
                  <Target size={8} color="#10B981" />
                  <Text style={styles.statText}>{stats.goals}</Text>
                </View>
              </>
            )}
          </View>
        </View>

        {isOnField && (
          <Star size={12} color="#10B981" fill="#10B981" />
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  compactPlayerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 8,
  },
  selectedPlayerCard: {
    borderColor: '#FF6B35',
    backgroundColor: '#FEF2F2',
    borderWidth: 2,
  },
  substitutingPlayerCard: {
    borderColor: '#FF6B35',
    backgroundColor: '#FEF2F2',
  },
  onFieldPlayerCard: {
    borderColor: '#10B981',
    backgroundColor: '#FFFFFF',
  },
  benchPlayerCard: {
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playerNumberBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerNumberText: {
    fontSize: 9,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  playerInfo: {
    flex: 1,
    minWidth: 0,
  },
  playerName: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 2,
  },
  playerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  positionText: {
    fontSize: 9,
    fontFamily: 'Inter-Medium',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metaSeparator: {
    fontSize: 8,
    color: '#D1D5DB',
    fontFamily: 'Inter-Regular',
  },
  timeText: {
    fontSize: 9,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  statText: {
    fontSize: 8,
    fontFamily: 'Inter-Bold',
    color: '#10B981',
  },
});