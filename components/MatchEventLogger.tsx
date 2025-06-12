import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Modal } from 'react-native';
import { Target, AlertTriangle, ArrowUpDown, Plus, X } from 'lucide-react-native';
import { Player, MatchEvent } from '@/types/database';

interface Props {
  players: Player[];
  onAddEvent: (event: Omit<MatchEvent, 'id' | 'timestamp'>) => void;
  currentTime: number;
  currentQuarter: number;
}

export function MatchEventLogger({ players, onAddEvent, currentTime, currentQuarter }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [eventType, setEventType] = useState<'goal' | 'card' | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [details, setDetails] = useState('');

  const handleAddEvent = () => {
    if (!eventType || !selectedPlayer) return;

    onAddEvent({
      type: eventType,
      time: currentTime,
      quarter: currentQuarter,
      player: selectedPlayer,
      details: details.trim() || undefined,
    });

    // Reset form
    setEventType(null);
    setSelectedPlayer(null);
    setDetails('');
    setShowModal(false);
  };

  const quickActions = [
    {
      type: 'goal' as const,
      icon: Target,
      label: 'Goal',
      color: '#10B981',
      bgColor: '#ECFDF5',
    },
    {
      type: 'card' as const,
      icon: AlertTriangle,
      label: 'Kaart',
      color: '#F59E0B',
      bgColor: '#FFFBEB',
    },
  ];

  return (
    <>
      <View style={styles.container}>
        <Text style={styles.title}>Snelle Acties</Text>
        <View style={styles.quickActions}>
          {quickActions.map((action) => (
            <TouchableOpacity
              key={action.type}
              style={[styles.quickActionButton, { backgroundColor: action.bgColor }]}
              onPress={() => {
                setEventType(action.type);
                setShowModal(true);
              }}
            >
              <action.icon size={16} color={action.color} />
              <Text style={[styles.quickActionText, { color: action.color }]}>
                {action.label}
              </Text>
            </TouchableOpacity>
          ))}
          
          <TouchableOpacity
            style={styles.moreButton}
            onPress={() => setShowModal(true)}
          >
            <Plus size={16} color="#6B7280" />
            <Text style={styles.moreButtonText}>Meer</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Gebeurtenis Toevoegen</Text>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <X size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <Text style={styles.sectionTitle}>Type Gebeurtenis</Text>
            <View style={styles.eventTypes}>
              {quickActions.map((action) => (
                <TouchableOpacity
                  key={action.type}
                  style={[
                    styles.eventTypeButton,
                    eventType === action.type && styles.eventTypeButtonActive
                  ]}
                  onPress={() => setEventType(action.type)}
                >
                  <action.icon size={20} color={eventType === action.type ? '#FFFFFF' : action.color} />
                  <Text style={[
                    styles.eventTypeText,
                    eventType === action.type && styles.eventTypeTextActive
                  ]}>
                    {action.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionTitle}>Speler Selecteren</Text>
            <View style={styles.playersList}>
              {players.map((player) => (
                <TouchableOpacity
                  key={player.id}
                  style={[
                    styles.playerButton,
                    selectedPlayer?.id === player.id && styles.playerButtonActive
                  ]}
                  onPress={() => setSelectedPlayer(player)}
                >
                  <Text style={styles.playerNumber}>#{player.number || '?'}</Text>
                  <Text style={[
                    styles.playerName,
                    selectedPlayer?.id === player.id && styles.playerNameActive
                  ]}>
                    {player.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionTitle}>Details (optioneel)</Text>
            <TextInput
              style={styles.detailsInput}
              value={details}
              onChangeText={setDetails}
              placeholder="Voeg extra details toe..."
              multiline
              numberOfLines={3}
            />

            <TouchableOpacity
              style={[
                styles.addButton,
                (!eventType || !selectedPlayer) && styles.addButtonDisabled
              ]}
              onPress={handleAddEvent}
              disabled={!eventType || !selectedPlayer}
            >
              <Text style={styles.addButtonText}>Gebeurtenis Toevoegen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
    marginBottom: 12,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 8,
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
    flex: 1,
  },
  quickActionText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
  },
  moreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    gap: 6,
  },
  moreButtonText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
  },
  modal: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
    marginBottom: 8,
    marginTop: 16,
  },
  eventTypes: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  eventTypeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    gap: 8,
    flex: 1,
  },
  eventTypeButtonActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  eventTypeText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
  },
  eventTypeTextActive: {
    color: '#FFFFFF',
  },
  playersList: {
    maxHeight: 200,
    marginBottom: 16,
  },
  playerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 6,
    gap: 10,
  },
  playerButtonActive: {
    backgroundColor: '#F0FDF4',
    borderColor: '#10B981',
  },
  playerNumber: {
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    color: '#6B7280',
    width: 30,
  },
  playerName: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    flex: 1,
  },
  playerNameActive: {
    color: '#10B981',
  },
  detailsInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  addButton: {
    backgroundColor: '#10B981',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  addButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  addButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
});