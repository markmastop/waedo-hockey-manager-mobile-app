import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Play, Pause, Square, SkipForward, Clock } from 'lucide-react-native';

interface Props {
  matchTime: number;
  currentQuarter: number;
  quarterTimes: number[];
  status: 'upcoming' | 'inProgress' | 'paused' | 'completed';
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
  onNextQuarter: () => void;
  onTimeUpdate: (time: number) => void;
}

export function LiveMatchTimer({
  matchTime,
  currentQuarter,
  quarterTimes,
  status,
  onStart,
  onPause,
  onResume,
  onEnd,
  onNextQuarter,
  onTimeUpdate,
}: Props) {
  const [localTime, setLocalTime] = useState(matchTime);

  useEffect(() => {
    setLocalTime(matchTime);
  }, [matchTime]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (status === 'inProgress') {
      interval = setInterval(() => {
        setLocalTime(prev => {
          const newTime = prev + 1;
          onTimeUpdate(newTime);
          return newTime;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [status, onTimeUpdate]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getCurrentQuarterTime = () => {
    const previousQuartersTime = quarterTimes.slice(0, currentQuarter - 1).reduce((sum, time) => sum + time, 0);
    return localTime - previousQuartersTime;
  };

  const getQuarterProgress = () => {
    const quarterTime = getCurrentQuarterTime();
    const maxQuarterTime = 15 * 60; // 15 minutes per quarter
    return Math.min(quarterTime / maxQuarterTime, 1);
  };

  return (
    <View style={styles.container}>
      <View style={styles.timeDisplay}>
        <View style={styles.mainTimer}>
          <Clock size={20} color="#374151" />
          <Text style={styles.timeText}>{formatTime(localTime)}</Text>
        </View>
        
        <View style={styles.quarterInfo}>
          <Text style={styles.quarterText}>Kwart {currentQuarter}</Text>
          <Text style={styles.quarterTime}>
            {formatTime(getCurrentQuarterTime())}
          </Text>
        </View>
        
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { width: `${getQuarterProgress() * 100}%` }
              ]} 
            />
          </View>
        </View>
      </View>

      <View style={styles.controls}>
        {status === 'upcoming' && (
          <TouchableOpacity style={styles.startButton} onPress={onStart}>
            <Play size={16} color="#FFFFFF" />
            <Text style={styles.startButtonText}>Start Wedstrijd</Text>
          </TouchableOpacity>
        )}

        {status === 'inProgress' && (
          <>
            <TouchableOpacity style={styles.controlButton} onPress={onPause}>
              <Pause size={14} color="#374151" />
              <Text style={styles.controlButtonText}>Pauzeren</Text>
            </TouchableOpacity>
            
            {currentQuarter < 4 && (
              <TouchableOpacity style={styles.controlButton} onPress={onNextQuarter}>
                <SkipForward size={14} color="#374151" />
                <Text style={styles.controlButtonText}>Volgend Kwart</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity style={styles.endButton} onPress={onEnd}>
              <Square size={14} color="#FFFFFF" />
              <Text style={styles.endButtonText}>Beëindigen</Text>
            </TouchableOpacity>
          </>
        )}

        {status === 'paused' && (
          <>
            <TouchableOpacity style={styles.startButton} onPress={onResume}>
              <Play size={14} color="#FFFFFF" />
              <Text style={styles.startButtonText}>Hervatten</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.endButton} onPress={onEnd}>
              <Square size={14} color="#FFFFFF" />
              <Text style={styles.endButtonText}>Beëindigen</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <View style={styles.statusIndicator}>
        <View 
          style={[
            styles.statusDot,
            { backgroundColor: status === 'inProgress' ? '#10B981' : status === 'paused' ? '#F59E0B' : '#6B7280' }
          ]} 
        />
        <Text style={[
          styles.statusText,
          { color: status === 'inProgress' ? '#10B981' : status === 'paused' ? '#F59E0B' : '#6B7280' }
        ]}>
          {status === 'inProgress' ? 'LIVE' : 
           status === 'paused' ? 'GEPAUZEERD' : 
           status === 'upcoming' ? 'AANKOMEND' : 'AFGEROND'}
        </Text>
      </View>
    </View>
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
  timeDisplay: {
    alignItems: 'center',
    marginBottom: 16,
  },
  mainTimer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  timeText: {
    fontSize: 32,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  quarterInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  quarterText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
  },
  quarterTime: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  progressContainer: {
    width: '100%',
    alignItems: 'center',
  },
  progressBar: {
    width: 200,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 2,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  startButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 4,
  },
  controlButtonText: {
    color: '#374151',
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
  },
  endButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DC2626',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 4,
  },
  endButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});