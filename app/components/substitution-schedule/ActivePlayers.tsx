import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Clock, Shield } from 'lucide-react-native';

interface ActivePlayersProps {
  activePlayers: Record<string, any>;
  upcomingSubstitutions: any[];
  formation: any;
  getPositionColor: (position: string) => string;
  handlePlayerPress: (player: any) => void;
  formatTime: (time: number) => string;
}

const ActivePlayers: React.FC<ActivePlayersProps> = ({
  activePlayers,
  upcomingSubstitutions,
  formation,
  getPositionColor,
  handlePlayerPress,
  formatTime,
}) => {
  return (
    <View>
      {/* Current Active Players */}
      <View style={styles.activePlayersContainer}>
        <Text style={styles.sectionTitle}>Actieve Spelers</Text>
        {Object.keys(activePlayers).length === 0 ? (
          <View style={styles.emptyActivePlayers}>
            <Text style={styles.emptyActivePlayersText}>
              Geen actieve spelers gevonden
            </Text>
            <Text style={styles.emptyActivePlayersSubtext}>
              Controleer of er een startspelers zijn ingesteld
            </Text>
          </View>
        ) : (
          Object.entries(activePlayers).map(([position, player]) => (
            <TouchableOpacity
              key={position}
              style={styles.activePlayerCard}
              onPress={() => handlePlayerPress(player)}
            >
              <View style={[styles.positionIndicator, { backgroundColor: getPositionColor(position) }]} />
              <View style={styles.activePlayerInfo}>
                <Text style={styles.activePlayerPosition}>
                  {formation?.positions.find(pos => pos.name === position)?.label_translations?.nl || position}
                </Text>
                <View style={styles.activePlayerDetails}>
                  <Text style={styles.activePlayerName}>{player.name}</Text>
                  <Text style={styles.activePlayerNumber}>#{player.number}</Text>
                </View>
              </View>
              <View style={styles.activePlayerMeta}>
                <View style={[styles.conditionDot, { 
                  backgroundColor: (player.condition || 100) >= 80 ? '#10B981' : 
                                   (player.condition || 100) >= 60 ? '#F59E0B' : '#EF4444' 
                }]} />
                {player.isGoalkeeper && <Shield size={12} color="#EF4444" />}
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Upcoming Substitutions */}
      {upcomingSubstitutions.length > 0 && (
        <View style={styles.upcomingSection}>
          <Text style={styles.sectionTitle}>Aankomende Wissels</Text>
          <View style={styles.upcomingList}>
            {upcomingSubstitutions.map((event, index) => (
              <View key={index} style={styles.upcomingCard}>
                <View style={styles.upcomingTime}>
                  <Clock size={14} color="#F59E0B" />
                  <Text style={styles.upcomingTimeText}>
                    {formatTime(event.time)}
                  </Text>
                </View>
                <View style={styles.upcomingDetails}>
                  <Text style={styles.upcomingPosition}>
                    {formation?.positions.find(pos => pos.name === event.position)?.label_translations?.nl || event.position}
                  </Text>
                  <View style={styles.upcomingPlayer}>
                    <Text style={styles.upcomingPlayerName}>
                      {event.player.name} #{event.player.number}
                    </Text>
                    <Text style={styles.upcomingPlayerAction}>
                      → Komt erin
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  activePlayersContainer: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  emptyActivePlayers: {
    padding: 16,
    alignItems: 'center',
  },
  emptyActivePlayersText: {
    fontSize: 14,
    color: '#4B5563',
    textAlign: 'center',
  },
  emptyActivePlayersSubtext: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'center',
  },
  activePlayerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    gap: 8,
  },
  positionIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activePlayerInfo: {
    flex: 1,
  },
  activePlayerPosition: {
    fontSize: 12,
    color: '#4B5563',
    marginBottom: 2,
  },
  activePlayerDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activePlayerName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  activePlayerNumber: {
    fontSize: 14,
    color: '#4B5563',
  },
  activePlayerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  conditionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  upcomingSection: {
    marginBottom: 16,
  },
  upcomingList: {
    padding: 8,
  },
  upcomingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    marginBottom: 8,
    gap: 12,
  },
  upcomingTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  upcomingTimeText: {
    fontSize: 14,
    color: '#111827',
  },
  upcomingDetails: {
    flex: 1,
  },
  upcomingPosition: {
    fontSize: 12,
    color: '#4B5563',
    marginBottom: 2,
  },
  upcomingPlayer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  upcomingPlayerName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  upcomingPlayerAction: {
    fontSize: 12,
    color: '#10B981',
  },
});

export default ActivePlayers;
