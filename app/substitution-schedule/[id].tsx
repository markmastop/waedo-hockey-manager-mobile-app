import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Modal,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { 
  ArrowLeft, 
  Users, 
  Clock, 
  Filter,
  Search,
  User,
  Shield,
  Target,
  RotateCcw,
  Grid3x3,
  Eye,
  Download
} from 'lucide-react-native';

interface Player {
  id: string;
  name: string;
  number: number;
  teamId: string;
  condition: number;
  positions: string[];
  isGoalkeeper: boolean;
  isStandIn?: boolean;
}

interface SubstitutionData {
  formation_key: string;
  quarters: number;
  substitutions_per_quarter: number;
  subs_per_quarter: number;
  [key: string]: any;
}

interface ParsedSchedule {
  [position: string]: {
    [quarter: number]: Player[];
  };
}

interface PlayerDetailModalProps {
  player: Player | null;
  visible: boolean;
  onClose: () => void;
}

const { width: screenWidth } = Dimensions.get('window');

function PlayerDetailModal({ player, visible, onClose }: PlayerDetailModalProps) {
  if (!player) return null;

  const getPositionColor = (position: string) => {
    const pos = position.toLowerCase();
    if (pos.includes('goalkeeper')) return '#EF4444';
    if (pos.includes('back') || pos.includes('sweeper') || pos.includes('lastline')) return '#3B82F6';
    if (pos.includes('midfield')) return '#8B5CF6';
    if (pos.includes('forward') || pos.includes('striker')) return '#F59E0B';
    return '#6B7280';
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Speler Details</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Sluiten</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          <View style={styles.playerCard}>
            <View style={styles.playerHeader}>
              <View style={[styles.playerAvatar, { backgroundColor: getPositionColor(player.positions[0]) }]}>
                {player.isGoalkeeper ? (
                  <Shield size={24} color="#FFFFFF" />
                ) : (
                  <User size={24} color="#FFFFFF" />
                )}
              </View>
              <View style={styles.playerInfo}>
                <Text style={styles.playerName}>{player.name}</Text>
                <Text style={styles.playerNumber}>#{player.number}</Text>
                {player.isStandIn && (
                  <View style={styles.standInBadge}>
                    <Text style={styles.standInText}>Invaller</Text>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.conditionContainer}>
              <Text style={styles.conditionLabel}>Conditie</Text>
              <View style={styles.conditionBar}>
                <View style={[styles.conditionFill, { width: `${player.condition}%` }]} />
              </View>
              <Text style={styles.conditionText}>{player.condition}%</Text>
            </View>

            <View style={styles.positionsContainer}>
              <Text style={styles.sectionTitle}>Posities</Text>
              <View style={styles.positionsList}>
                {player.positions.map((position, index) => (
                  <View 
                    key={index} 
                    style={[styles.positionBadge, { backgroundColor: getPositionColor(position) }]}
                  >
                    <Text style={styles.positionText}>{position}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.playerStats}>
              <View style={styles.statItem}>
                <Target size={16} color="#10B981" />
                <Text style={styles.statLabel}>Type</Text>
                <Text style={styles.statValue}>
                  {player.isGoalkeeper ? 'Keeper' : 'Veldspeler'}
                </Text>
              </View>
              
              <View style={styles.statItem}>
                <Users size={16} color="#8B5CF6" />
                <Text style={styles.statLabel}>Team ID</Text>
                <Text style={styles.statValue}>{player.teamId.slice(-8)}</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

export default function SubstitutionScheduleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [scheduleData, setScheduleData] = useState<SubstitutionData | null>(null);
  const [parsedSchedule, setParsedSchedule] = useState<ParsedSchedule>({});
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [filterPosition, setFilterPosition] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'timeline'>('grid');

  useEffect(() => {
    fetchSubstitutionSchedule();
  }, [id]);

  const fetchSubstitutionSchedule = async () => {
    try {
      const { data, error } = await supabase
        .from('matches')
        .select('substitution_schedule')
        .eq('id', id)
        .single();

      if (error) throw error;

      if (data?.substitution_schedule) {
        setScheduleData(data.substitution_schedule);
        parseScheduleData(data.substitution_schedule);
      }
    } catch (error) {
      console.error('Error fetching substitution schedule:', error);
    } finally {
      setLoading(false);
    }
  };

  const parseScheduleData = (data: SubstitutionData) => {
    const parsed: ParsedSchedule = {};
    
    Object.entries(data).forEach(([key, value]) => {
      if (key.includes('-') && typeof value === 'object' && value?.id) {
        const parts = key.split('-');
        if (parts.length >= 3) {
          const position = parts[0];
          const quarter = parseInt(parts[1]);
          const slot = parseInt(parts[2]);

          if (!parsed[position]) {
            parsed[position] = {};
          }
          if (!parsed[position][quarter]) {
            parsed[position][quarter] = [];
          }
          
          parsed[position][quarter][slot] = value as Player;
        }
      }
    });

    setParsedSchedule(parsed);
  };

  const getPositions = () => {
    return Object.keys(parsedSchedule).sort();
  };

  const getQuarters = () => {
    return scheduleData?.quarters ? Array.from({ length: scheduleData.quarters }, (_, i) => i + 1) : [1, 2, 3, 4];
  };

  const handlePlayerPress = (player: Player) => {
    setSelectedPlayer(player);
    setModalVisible(true);
  };

  const getPositionDisplayName = (position: string) => {
    const positionMap: Record<string, string> = {
      'striker': 'Aanvaller',
      'sweeper': 'Libero',
      'lastLine': 'Laatste Lijn',
      'leftBack': 'Linksback',
      'rightBack': 'Rechtsback',
      'leftMidfield': 'Linksmidden',
      'rightMidfield': 'Rechtsmidden',
      'centerMidfield': 'Middenmidden',
      'leftForward': 'Linksvoorwaarts',
      'rightForward': 'Rechtsvoorwaarts',
      'goalkeeper': 'Keeper',
    };
    return positionMap[position] || position;
  };

  const getPositionColor = (position: string) => {
    const pos = position.toLowerCase();
    if (pos.includes('goalkeeper')) return '#EF4444';
    if (pos.includes('back') || pos.includes('sweeper') || pos.includes('lastline')) return '#3B82F6';
    if (pos.includes('midfield')) return '#8B5CF6';
    if (pos.includes('forward') || pos.includes('striker')) return '#F59E0B';
    return '#6B7280';
  };

  const filteredPositions = filterPosition === 'all' 
    ? getPositions() 
    : getPositions().filter(pos => pos.toLowerCase().includes(filterPosition.toLowerCase()));

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <RotateCcw size={32} color="#FF6B35" />
          <Text style={styles.loadingText}>Wisselschema laden...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!scheduleData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Users size={48} color="#9CA3AF" />
          <Text style={styles.emptyTitle}>Geen wisselschema gevonden</Text>
          <Text style={styles.emptySubtitle}>
            Er is geen wisselschema beschikbaar voor deze wedstrijd
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#374151" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.title}>Wisselschema</Text>
          <Text style={styles.subtitle}>
            {scheduleData.formation_key} • {scheduleData.quarters} kwarten
          </Text>
        </View>
        <TouchableOpacity style={styles.exportButton}>
          <Download size={20} color="#FF6B35" />
        </TouchableOpacity>
      </View>

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Grid3x3 size={16} color="#8B5CF6" />
          <Text style={styles.statLabel}>Formatie</Text>
          <Text style={styles.statValue}>{scheduleData.formation_key}</Text>
        </View>
        
        <View style={styles.statItem}>
          <Clock size={16} color="#10B981" />
          <Text style={styles.statLabel}>Kwarten</Text>
          <Text style={styles.statValue}>{scheduleData.quarters}</Text>
        </View>
        
        <View style={styles.statItem}>
          <RotateCcw size={16} color="#F59E0B" />
          <Text style={styles.statLabel}>Wissels/Kwart</Text>
          <Text style={styles.statValue}>{scheduleData.subs_per_quarter || scheduleData.substitutions_per_quarter}</Text>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <View style={styles.viewModeToggle}>
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'grid' && styles.activeToggle]}
            onPress={() => setViewMode('grid')}
          >
            <Grid3x3 size={16} color={viewMode === 'grid' ? '#FFFFFF' : '#6B7280'} />
            <Text style={[styles.toggleText, viewMode === 'grid' && styles.activeToggleText]}>
              Grid
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'timeline' && styles.activeToggle]}
            onPress={() => setViewMode('timeline')}
          >
            <Clock size={16} color={viewMode === 'timeline' ? '#FFFFFF' : '#6B7280'} />
            <Text style={[styles.toggleText, viewMode === 'timeline' && styles.activeToggleText]}>
              Timeline
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.filterButton}>
          <Filter size={16} color="#6B7280" />
          <Text style={styles.filterText}>Filter</Text>
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {viewMode === 'grid' ? (
          <View style={styles.gridContainer}>
            {/* Header Row */}
            <View style={styles.gridHeader}>
              <View style={styles.positionHeaderCell}>
                <Text style={styles.headerText}>Positie</Text>
              </View>
              {getQuarters().map(quarter => (
                <View key={quarter} style={styles.quarterHeaderCell}>
                  <Text style={styles.headerText}>Q{quarter}</Text>
                </View>
              ))}
            </View>

            {/* Data Rows */}
            {filteredPositions.map(position => (
              <View key={position} style={styles.gridRow}>
                <View style={styles.positionCell}>
                  <View style={[styles.positionIndicator, { backgroundColor: getPositionColor(position) }]} />
                  <Text style={styles.positionName} numberOfLines={2}>
                    {getPositionDisplayName(position)}
                  </Text>
                </View>
                
                {getQuarters().map(quarter => (
                  <View key={quarter} style={styles.quarterCell}>
                    {parsedSchedule[position]?.[quarter]?.map((player, index) => (
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
                                  backgroundColor: player.condition >= 80 ? '#10B981' : 
                                                 player.condition >= 60 ? '#F59E0B' : '#EF4444' 
                                }]} />
                                <Text style={styles.conditionValue}>{player.condition}%</Text>
                              </View>
                              {player.isGoalkeeper && (
                                <Shield size={10} color="#EF4444" />
                              )}
                              {player.isStandIn && (
                                <View style={styles.standInIndicator}>
                                  <Text style={styles.standInIndicatorText}>I</Text>
                                </View>
                              )}
                            </View>
                          </View>
                        </TouchableOpacity>
                      ) : (
                        <View key={index} style={styles.emptySlot}>
                          <Text style={styles.emptySlotText}>-</Text>
                        </View>
                      )
                    )) || (
                      <View style={styles.emptySlot}>
                        <Text style={styles.emptySlotText}>Geen spelers</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.timelineContainer}>
            <Text style={styles.timelineTitle}>Timeline Weergave</Text>
            <Text style={styles.timelineSubtitle}>Binnenkort beschikbaar</Text>
          </View>
        )}
      </ScrollView>

      {/* Player Detail Modal */}
      <PlayerDetailModal
        player={selectedPlayer}
        visible={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setSelectedPlayer(null);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    fontFamily: 'Inter-Medium',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#374151',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  headerInfo: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  subtitle: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Inter-Regular',
    marginTop: 2,
  },
  exportButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  statItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statLabel: {
    fontSize: 10,
    color: '#6B7280',
    fontFamily: 'Inter-Medium',
  },
  statValue: {
    fontSize: 12,
    color: '#111827',
    fontFamily: 'Inter-Bold',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  viewModeToggle: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 2,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  activeToggle: {
    backgroundColor: '#FF6B35',
  },
  toggleText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
  },
  activeToggleText: {
    color: '#FFFFFF',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 6,
  },
  filterText: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Inter-Medium',
  },
  content: {
    flex: 1,
  },
  gridContainer: {
    padding: 16,
  },
  gridHeader: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  positionHeaderCell: {
    width: 100,
    padding: 12,
    justifyContent: 'center',
  },
  quarterHeaderCell: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
    borderLeftWidth: 1,
    borderLeftColor: '#E5E7EB',
  },
  headerText: {
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    color: '#374151',
    textAlign: 'center',
  },
  gridRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 60,
  },
  positionCell: {
    width: 100,
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#F3F4F6',
  },
  positionIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginBottom: 4,
  },
  positionName: {
    fontSize: 10,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
    textAlign: 'center',
  },
  quarterCell: {
    flex: 1,
    padding: 4,
    gap: 2,
    borderLeftWidth: 1,
    borderLeftColor: '#F3F4F6',
  },
  playerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    padding: 4,
    gap: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  playerNumber: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerNumberText: {
    fontSize: 8,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  playerDetails: {
    flex: 1,
    minWidth: 0,
  },
  playerName: {
    fontSize: 9,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 1,
  },
  playerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  conditionIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  conditionDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  conditionValue: {
    fontSize: 7,
    color: '#6B7280',
    fontFamily: 'Inter-Regular',
  },
  standInIndicator: {
    backgroundColor: '#F59E0B',
    width: 10,
    height: 10,
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  standInIndicatorText: {
    fontSize: 6,
    color: '#FFFFFF',
    fontFamily: 'Inter-Bold',
  },
  emptySlot: {
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySlotText: {
    fontSize: 10,
    color: '#9CA3AF',
    fontFamily: 'Inter-Regular',
  },
  timelineContainer: {
    padding: 40,
    alignItems: 'center',
  },
  timelineTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#374151',
    marginBottom: 8,
  },
  timelineSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter-Regular',
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  closeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
  },
  closeButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  playerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  playerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 16,
  },
  playerAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginBottom: 4,
  },
  playerNumber: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
    marginBottom: 8,
  },
  standInBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  standInText: {
    fontSize: 10,
    fontFamily: 'Inter-Bold',
    color: '#D97706',
  },
  conditionContainer: {
    marginBottom: 20,
  },
  conditionLabel: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
    marginBottom: 8,
  },
  conditionBar: {
    height: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  conditionFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 4,
  },
  conditionText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    textAlign: 'right',
  },
  positionsContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
    marginBottom: 8,
  },
  positionsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  positionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  positionText: {
    fontSize: 10,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  playerStats: {
    gap: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    flex: 1,
  },
  statValue: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
});