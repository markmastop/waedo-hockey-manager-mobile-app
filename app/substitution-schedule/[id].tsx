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
import { convertPlayersDataToArray } from '@/lib/playerUtils';
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
  Download,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight
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
  position?: string; // Add position field for match lineup
}

interface SubstitutionData {
  formation_key: string;
  quarters: number;
  substitutions_per_quarter: number;
  subs_per_quarter: number;
  time: number; // Match time in minutes
  [key: string]: any;
}

interface ParsedSchedule {
  [position: string]: {
    [quarter: number]: Player[];
  };
}

interface TimelineEvent {
  time: number; // Time in seconds
  quarter: number;
  position: string;
  slot: number;
  player: Player;
  isSubstitution: boolean;
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
              <View style={[styles.playerAvatar, { backgroundColor: getPositionColor(player.positions?.[0] || player.position || '') }]}>
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
                <View style={[styles.conditionFill, { width: `${player.condition || 100}%` }]} />
              </View>
              <Text style={styles.conditionText}>{player.condition || 100}%</Text>
            </View>

            <View style={styles.positionsContainer}>
              <Text style={styles.sectionTitle}>Posities</Text>
              <View style={styles.positionsList}>
                {(player.positions || [player.position].filter(Boolean)).map((position, index) => (
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
                <Text style={styles.statValue}>{player.teamId?.slice(-8) || 'N/A'}</Text>
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
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [startingLineup, setStartingLineup] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [filterPosition, setFilterPosition] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'timeline'>('timeline');
  const [currentTime, setCurrentTime] = useState(0); // Current match time in seconds
  const [isPlaying, setIsPlaying] = useState(false);
  const [timelinePosition, setTimelinePosition] = useState(0);

  useEffect(() => {
    fetchSubstitutionSchedule();
  }, [id]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentTime(prev => {
          const newTime = prev + 1;
          if (newTime >= 60 * 60) { // 60 minutes max
            setIsPlaying(false);
            return prev;
          }
          return newTime;
        });
      }, 100); // Fast forward for demo
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  const fetchSubstitutionSchedule = async () => {
    try {
      // Fetch both substitution schedule and match lineup
      const { data, error } = await supabase
        .from('matches')
        .select('substitution_schedule, lineup')
        .eq('id', id)
        .single();

      if (error) throw error;

      if (data?.substitution_schedule) {
        setScheduleData(data.substitution_schedule);
        parseScheduleData(data.substitution_schedule);
        generateTimelineEvents(data.substitution_schedule);
      }

      // Set starting lineup from match data - ensure it's properly formatted
      if (data?.lineup) {
        const lineupArray = convertPlayersDataToArray(data.lineup);
        // Ensure each player has required fields for the timeline
        const formattedLineup = lineupArray.map(player => ({
          id: player.id,
          name: player.name,
          number: player.number || 0,
          position: player.position,
          teamId: id, // Use match ID as team ID
          condition: 100, // Default condition
          positions: [player.position].filter(Boolean),
          isGoalkeeper: player.position?.toLowerCase().includes('goalkeeper') || false,
          isStandIn: false,
        }));
        console.log('📋 Setting starting lineup:', formattedLineup);
        setStartingLineup(formattedLineup);
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

  const generateTimelineEvents = (data: SubstitutionData) => {
    const events: TimelineEvent[] = [];
    const quarterDuration = 15 * 60; // 15 minutes per quarter in seconds
    const subsPerQuarter = data.subs_per_quarter || data.substitutions_per_quarter || 2;
    
    Object.entries(data).forEach(([key, value]) => {
      if (key.includes('-') && typeof value === 'object' && value?.id) {
        const parts = key.split('-');
        if (parts.length >= 3) {
          const position = parts[0];
          const quarter = parseInt(parts[1]);
          const slot = parseInt(parts[2]);
          
          // Calculate time based on quarter and slot
          const quarterStartTime = (quarter - 1) * quarterDuration;
          const slotInterval = quarterDuration / (subsPerQuarter + 1);
          const eventTime = quarterStartTime + (slot + 1) * slotInterval;
          
          events.push({
            time: eventTime,
            quarter,
            position,
            slot,
            player: value as Player,
            isSubstitution: slot > 0, // First slot is starting lineup
          });
        }
      }
    });

    // Sort events by time
    events.sort((a, b) => a.time - b.time);
    setTimelineEvents(events);
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getCurrentQuarter = (time: number) => {
    return Math.floor(time / (15 * 60)) + 1;
  };

  const getActivePlayersAtTime = (time: number) => {
    console.log('🔍 Getting active players at time:', time, 'Starting lineup:', startingLineup.length);
    
    const activePlayers: Record<string, Player> = {};
    
    // ALWAYS start with the starting lineup from match data - this is the foundation
    if (startingLineup && startingLineup.length > 0) {
      startingLineup.forEach(player => {
        if (player.position) {
          activePlayers[player.position] = player;
          console.log(`📍 Added starting player: ${player.name} at ${player.position}`);
        }
      });
    }
    
    // Only apply substitutions that have occurred up to current time (and only if time > 0)
    if (time > 0) {
      const pastEvents = timelineEvents.filter(event => 
        event.time <= time && event.isSubstitution
      );
      
      // Apply each substitution in chronological order
      pastEvents.forEach(event => {
        activePlayers[event.position] = event.player;
        console.log(`🔄 Substitution: ${event.player.name} at ${event.position} (time: ${event.time})`);
      });
    }
    
    console.log('✅ Final active players:', Object.keys(activePlayers).length);
    return activePlayers;
  };

  const getUpcomingSubstitutions = (time: number, lookAhead: number = 120) => {
    return timelineEvents.filter(event => 
      event.time > time && 
      event.time <= time + lookAhead && 
      event.isSubstitution
    );
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

  // Calculate active players with proper memoization to prevent flashing
  // This ensures the starting lineup is ALWAYS shown at time 0 and substitutions are applied correctly
  const activePlayers = React.useMemo(() => {
    return getActivePlayersAtTime(currentTime);
  }, [currentTime, startingLineup, timelineEvents]);

  const upcomingSubstitutions = getUpcomingSubstitutions(currentTime);
  const currentQuarter = getCurrentQuarter(currentTime);

  // Calculate timeline progress
  const maxTime = timelineEvents.length > 0 ? Math.max(...timelineEvents.map(e => e.time)) : 3600; // Default to 60 minutes
  const timelineProgress = Math.min((currentTime / maxTime) * 100, 100);

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

      {/* Time Control */}
      <View style={styles.timeControl}>
        <View style={styles.timeDisplay}>
          <Text style={styles.currentTimeText}>{formatTime(currentTime)}</Text>
          <Text style={styles.quarterText}>Kwart {currentQuarter}</Text>
        </View>
        
        <View style={styles.playControls}>
          <TouchableOpacity 
            style={styles.controlButton}
            onPress={() => setCurrentTime(Math.max(0, currentTime - 60))}
          >
            <ChevronLeft size={16} color="#6B7280" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.controlButton, styles.playButton]}
            onPress={() => setIsPlaying(!isPlaying)}
          >
            {isPlaying ? (
              <Pause size={16} color="#FFFFFF" />
            ) : (
              <Play size={16} color="#FFFFFF" />
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.controlButton}
            onPress={() => setCurrentTime(Math.min(60 * 60, currentTime + 60))}
          >
            <ChevronRight size={16} color="#6B7280" />
          </TouchableOpacity>
        </View>

        <View style={styles.timeSlider}>
          <View style={styles.timeTrack}>
            <View 
              style={[
                styles.timeProgress, 
                { width: `${timelineProgress}%` }
              ]} 
            />
            {/* Timeline markers for substitutions */}
            {timelineEvents.filter(e => e.isSubstitution).map((event, index) => (
              <View 
                key={index}
                style={[
                  styles.timeMarker,
                  { left: `${(event.time / maxTime) * 100}%` },
                  event.time <= currentTime && styles.passedMarker
                ]}
              />
            ))}
          </View>
        </View>
      </View>

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Users size={16} color="#10B981" />
          <Text style={styles.statLabel}>Actieve Spelers</Text>
          <Text style={styles.statValue}>{Object.keys(activePlayers).length}</Text>
        </View>
        
        <View style={styles.statItem}>
          <Clock size={16} color="#F59E0B" />
          <Text style={styles.statLabel}>Aankomende Wissels</Text>
          <Text style={styles.statValue}>{upcomingSubstitutions.length}</Text>
        </View>
        
        <View style={styles.statItem}>
          <Target size={16} color="#8B5CF6" />
          <Text style={styles.statLabel}>Kwart</Text>
          <Text style={styles.statValue}>{currentQuarter}/4</Text>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <View style={styles.viewModeToggle}>
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'timeline' && styles.activeToggle]}
            onPress={() => setViewMode('timeline')}
          >
            <Clock size={16} color={viewMode === 'timeline' ? '#FFFFFF' : '#6B7280'} />
            <Text style={[styles.toggleText, viewMode === 'timeline' && styles.activeToggleText]}>
              Live
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'grid' && styles.activeToggle]}
            onPress={() => setViewMode('grid')}
          >
            <Grid3x3 size={16} color={viewMode === 'grid' ? '#FFFFFF' : '#6B7280'} />
            <Text style={[styles.toggleText, viewMode === 'grid' && styles.activeToggleText]}>
              Grid
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
        {viewMode === 'timeline' ? (
          <View style={styles.timelineContainer}>
            {/* Current Active Players */}
            <View style={styles.activePlayersSection}>
              <Text style={styles.sectionTitle}>
                {currentTime === 0 ? 'Startopstelling (00:00)' : `Huidige Opstelling (${formatTime(currentTime)})`}
              </Text>
              <View style={styles.activePlayersList}>
                {Object.keys(activePlayers).length === 0 ? (
                  <View style={styles.emptyActivePlayersContainer}>
                    <Users size={32} color="#9CA3AF" />
                    <Text style={styles.emptyActivePlayersText}>
                      Geen actieve spelers gevonden
                    </Text>
                    <Text style={styles.emptyActivePlayersSubtext}>
                      Controleer of er een startopstelling is ingesteld
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
                          {getPositionDisplayName(position)}
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
                          {getPositionDisplayName(event.position)}
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

            {/* Full Timeline */}
            <View style={styles.fullTimelineSection}>
              <Text style={styles.sectionTitle}>Volledige Timeline</Text>
              <View style={styles.timelineList}>
                {timelineEvents.map((event, index) => (
                  <View 
                    key={index} 
                    style={[
                      styles.timelineEvent,
                      event.time <= currentTime && styles.pastEvent,
                      event.time > currentTime && event.time <= currentTime + 120 && styles.upcomingEvent
                    ]}
                  >
                    <View style={styles.timelineEventTime}>
                      <Text style={[
                        styles.timelineEventTimeText,
                        event.time <= currentTime && styles.pastEventText
                      ]}>
                        {formatTime(event.time)}
                      </Text>
                      <Text style={[
                        styles.timelineEventQuarter,
                        event.time <= currentTime && styles.pastEventText
                      ]}>
                        Q{event.quarter}
                      </Text>
                    </View>
                    
                    <View style={styles.timelineEventContent}>
                      <View style={styles.timelineEventHeader}>
                        <Text style={[
                          styles.timelineEventPosition,
                          event.time <= currentTime && styles.pastEventText
                        ]}>
                          {getPositionDisplayName(event.position)}
                        </Text>
                        <View style={[
                          styles.timelineEventType,
                          { backgroundColor: event.isSubstitution ? '#F59E0B' : '#10B981' }
                        ]}>
                          <Text style={styles.timelineEventTypeText}>
                            {event.isSubstitution ? 'Wissel' : 'Start'}
                          </Text>
                        </View>
                      </View>
                      
                      <TouchableOpacity 
                        style={styles.timelineEventPlayer}
                        onPress={() => handlePlayerPress(event.player)}
                      >
                        <View style={[styles.playerNumber, { backgroundColor: getPositionColor(event.position) }]}>
                          <Text style={styles.playerNumberText}>{event.player.number}</Text>
                        </View>
                        <Text style={[
                          styles.timelineEventPlayerName,
                          event.time <= currentTime && styles.pastEventText
                        ]}>
                          {event.player.name}
                        </Text>
                        {event.player.isGoalkeeper && <Shield size={12} color="#EF4444" />}
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </View>
        ) : (
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
                                  backgroundColor: (player.condition || 100) >= 80 ? '#10B981' : 
                                                 (player.condition || 100) >= 60 ? '#F59E0B' : '#EF4444' 
                                }]} />
                                <Text style={styles.conditionValue}>{player.condition || 100}%</Text>
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
  timeControl: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  timeDisplay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  currentTimeText: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  quarterText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
  },
  playControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  controlButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    backgroundColor: '#FF6B35',
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  timeSlider: {
    paddingHorizontal: 4,
  },
  timeTrack: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    position: 'relative',
  },
  timeProgress: {
    height: '100%',
    backgroundColor: '#FF6B35',
    borderRadius: 3,
  },
  timeMarker: {
    position: 'absolute',
    top: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F59E0B',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    transform: [{ translateX: -5 }],
  },
  passedMarker: {
    backgroundColor: '#10B981',
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
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
  // Timeline View Styles
  timelineContainer: {
    padding: 16,
  },
  activePlayersSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#111827',
    marginBottom: 12,
  },
  activePlayersList: {
    gap: 8,
  },
  emptyActivePlayersContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyActivePlayersText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
    marginTop: 12,
    marginBottom: 6,
  },
  emptyActivePlayersSubtext: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 24,
    fontFamily: 'Inter-Regular',
  },
  activePlayerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  positionIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  activePlayerInfo: {
    flex: 1,
  },
  activePlayerPosition: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
    marginBottom: 4,
  },
  activePlayerDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activePlayerName: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  activePlayerNumber: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  activePlayerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  conditionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  upcomingSection: {
    marginBottom: 24,
  },
  upcomingList: {
    gap: 8,
  },
  upcomingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FED7AA',
    gap: 12,
  },
  upcomingTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  upcomingTimeText: {
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    color: '#D97706',
  },
  upcomingDetails: {
    flex: 1,
  },
  upcomingPosition: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#92400E',
    marginBottom: 2,
  },
  upcomingPlayer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  upcomingPlayerName: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  upcomingPlayerAction: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#D97706',
  },
  fullTimelineSection: {
    marginBottom: 24,
  },
  timelineList: {
    gap: 8,
  },
  timelineEvent: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  pastEvent: {
    backgroundColor: '#F9FAFB',
    opacity: 0.7,
  },
  upcomingEvent: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FED7AA',
  },
  timelineEventTime: {
    width: 80,
    padding: 12,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
  },
  timelineEventTimeText: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  timelineEventQuarter: {
    fontSize: 10,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    marginTop: 2,
  },
  pastEventText: {
    color: '#9CA3AF',
  },
  timelineEventContent: {
    flex: 1,
    padding: 12,
  },
  timelineEventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  timelineEventPosition: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
  },
  timelineEventType: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  timelineEventTypeText: {
    fontSize: 9,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  timelineEventPlayer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  timelineEventPlayerName: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    flex: 1,
  },
  // Grid View Styles (keeping existing)
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
  // Modal Styles (keeping existing)
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