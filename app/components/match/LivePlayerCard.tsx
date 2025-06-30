import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Shield, ArrowRight } from 'lucide-react-native';
import { Player } from '@/types/database';
import { styles as matchStyles } from '../../styles/match';
import { getPositionColor } from '@/lib/playerPositions';

interface Props {
  player: Player;
  positionName: string;
  onPress?: () => void;
  selected?: boolean;
  bench?: boolean;
  numberColor?: string;
  conditionColor?: string;
  nextPositionName?: string;
}

export default function LivePlayerCard({
  player,
  positionName,
  onPress,
  selected,
  bench,
  numberColor,
  conditionColor = '#10B981',
  nextPositionName,
}: Props) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        matchStyles.livePlayerCard,
        bench && matchStyles.benchPlayerCard,
        selected && (bench ? matchStyles.selectedBenchPlayerCard : matchStyles.selectedFieldPlayerCard),
      ]}
      accessibilityLabel={`Speler ${player.name}`}
    >
      <View style={[matchStyles.livePlayerNumberBadge, { backgroundColor: numberColor || getPositionColor(player.position) }]}>
        <Text style={matchStyles.livePlayerNumberText}>#{player.number}</Text>
      </View>
      <View style={matchStyles.livePlayerInfo}>
        {bench && <Text style={matchStyles.reserveLabel}>Reserve</Text>}
        <Text style={matchStyles.livePlayerPosition}>{positionName}</Text>
        <View style={matchStyles.livePlayerDetails}>
          <Text style={matchStyles.livePlayerName}>{player.name}</Text>
          {nextPositionName && (
            <View style={matchStyles.nextPositionContainer}>
              <ArrowRight size={10} color="#6B7280" />
              <Text style={matchStyles.nextPositionText}>{nextPositionName}</Text>
            </View>
          )}
        </View>
      </View>
      <View style={matchStyles.livePlayerMeta}>
        <View style={[matchStyles.conditionDot, { backgroundColor: conditionColor }]} />
        {(player.isGoalkeeper || player.position?.toLowerCase().includes('goalkeeper')) && (
          <Shield size={12} color="#EF4444" />
        )}
      </View>
    </TouchableOpacity>
  );
}
