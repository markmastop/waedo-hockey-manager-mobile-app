import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Shield } from 'lucide-react-native';

interface GridContainerProps {
  getQuarters: () => number[];
  formation: any;
  filteredPositions: string[];
  parsedSchedule: any;
  getPositionColor: (position: string) => string;
  handlePlayerPress: (player: any) => void;
}

const GridContainer: React.FC<GridContainerProps> = ({
  getQuarters,
  formation,
  filteredPositions,
  parsedSchedule,
  getPositionColor,
  handlePlayerPress,
}) => {
  return (
    <View style={styles.gridContainer}>
      {/* Header Row */}
      <View style={styles.gridHeader}>
        <View style={styles.positionHeaderCell}>
          <Text style={styles.headerText}>Positie</Text>
        </View>
        {getQuarters().map((quarter: number) => (
          <View key={quarter} style={styles.quarterHeaderCell}>
            <Text style={styles.headerText}>Q{quarter}</Text>
          </View>
        ))}
      </View>

      {/* Data Rows */}
      {filteredPositions.map((position: string) => (
        <View key={position} style={styles.gridRow}>
          <View style={styles.positionCell}>
            <View style={[styles.positionIndicator, { backgroundColor: getPositionColor(position) }]} />
            <Text style={styles.positionName} numberOfLines={2}>
              {formation?.positions.find(pos => pos.name === position)?.label_translations?.nl || position}
            </Text>
          </View>
          
          {getQuarters().map((quarter: number) => (
            <View key={quarter} style={styles.quarterCell}>
              {parsedSchedule[position]?.[quarter]?.map((player: any, index: number) => (
                player ? (
                  <TouchableOpacity
                    key={`${player.id}-${index}`}
                    style={styles.playerChip}
                    onPress={() => handlePlayerPress(player)}
                  >
                    <View style={[styles.playerNumber, { backgroundColor: getPositionColor(position) }]}>
                      <Text style={styles.playerNumberText}>{player.number}</Text>
                    </View>
                    <View style={styles.playerDetails}>
                      <Text style={styles.playerName} numberOfLines={1}>
                        {player.name}
                      </Text>
                      <View style={styles.playerMeta}>
                        <View style={styles.conditionIndicator}>
                          <View style={[styles.conditionDot, { 
                            backgroundColor: (player.condition || 100) >= 80 ? '#10B981' : 
                                           (player.condition || 100) >= 60 ? '#F59E0B' : '#EF4444' 
                          }]} />
                          <Text style={styles.conditionValue}>{player.condition || 100}%</Text>
                        </View>
                        {player.isGoalkeeper && (
                          <Shield size={10} color="#EF4444" />
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                ) : null
              ))}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  gridContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginTop: 16,
  },
  gridHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 8,
  },
  positionHeaderCell: {
    flex: 1,
    alignItems: 'center',
  },
  quarterHeaderCell: {
    flex: 1,
    alignItems: 'center',
  },
  headerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  gridRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  positionCell: {
    flex: 1,
    marginRight: 16,
  },
  positionIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  positionName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  quarterCell: {
    flex: 1,
    alignItems: 'center',
  },
  playerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    marginVertical: 4,
    width: '100%',
  },
  playerNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  playerNumberText: {
    fontSize: 12,
    fontWeight: '600',
  },
  playerDetails: {
    flex: 1,
  },
  playerName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#111827',
  },
  playerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  conditionIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  conditionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  conditionValue: {
    fontSize: 10,
    color: '#4B5563',
  },
});

export default GridContainer;
