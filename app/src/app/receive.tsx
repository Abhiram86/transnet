import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import Transnet, { parseProgressStr, TransferProgress } from '../../modules/transnet/src/TransnetModule';
import { Colors } from '../constants/theme';
import { StepIndicator } from '../components/StepIndicator';
import { TransferProgressBar } from '../components/TransferProgressBar';

type Step = 'ready' | 'waiting' | 'done';

const Radar = ({ active }: { active: boolean }) => {
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (active) {
      rotation.value = withRepeat(withTiming(360, { duration: 4000, easing: Easing.linear }), -1);
    } else {
      rotation.value = 0;
    }
  }, [active]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View style={styles.radarWrap}>
      <View style={[styles.radarRing, styles.ring1]} />
      <View style={[styles.radarRing, styles.ring2]} />
      <View style={[styles.radarRing, styles.ring3]} />
      <Animated.View style={[styles.radarSweep, animatedStyle]} />
      <MaterialCommunityIcons
        name="wifi-strength-4"
        size={56}
        color={active ? Colors.accent : Colors.surfaceLight}
        style={{ zIndex: 1 }}
      />
    </View>
  );
};

export default function ReceiveScreen() {
  const [step, setStep] = useState<Step>('ready');
  const [status, setStatus] = useState('Tap below to start');
  const [senderName, setSenderName] = useState('');
  const [progress, setProgress] = useState<TransferProgress | null>(null);
  const [isReceiving, setIsReceiving] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stepIndex = step === 'ready' ? 0 : step === 'waiting' ? 1 : 2;

  useEffect(() => {
    if (!isReceiving) return;

    pollingRef.current = setInterval(async () => {
      try {
        const [rawProgress, rawStatus] = await Promise.all([
          Transnet.getServerProgress(),
          Transnet.getServerStatus(),
        ]);
        setProgress(parseProgressStr(rawProgress));

        if (rawStatus === 'done') {
          setIsReceiving(false);
          setProgress(prev => prev ? { ...prev, percentDone: 100 } : null);
          setStatus('Transfer complete!');
          setStep('done');
        } else if (rawStatus === 'cancelled') {
          setIsReceiving(false);
          setProgress(null);
          setStatus('Transfer cancelled. Tap to try again.');
          setStep('ready');
          Alert.alert('Cancelled', 'Transfer was cancelled.');
        } else if (rawStatus.startsWith('error:')) {
          setIsReceiving(false);
          setProgress(null);
          setStatus('Transfer failed. Tap to try again.');
          setStep('ready');
          Alert.alert('Error', rawStatus.slice(7));
        }
      } catch {}
    }, 200);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [isReceiving]);

  const startReceiving = async () => {
    setStep('waiting');
    setStatus('Listening for incoming connections...');
    setProgress(null);
    try {
      const offerInfo = await Transnet.listenFileTransfer();
      const [name, , senderAddr] = offerInfo.split('<|sep|>');
      setSenderName(name);
      setStatus(`Receiving files from ${name}...`);
      await Transnet.acceptFileTransfer(senderAddr);
      setIsReceiving(true);
      Transnet.startServer('8080');
    } catch (e: any) {
      setIsReceiving(false);
      setStatus('Nothing received. Tap to try again.');
      setStep('ready');
      Alert.alert('Timed out', 'Make sure the sender is searching on the same network.');
    }
  };

  const reset = () => {
    setStep('ready');
    setStatus('Tap below to start');
    setSenderName('');
    setProgress(null);
    setIsReceiving(false);
  };

  const stopServices = async () => {
    try {
      await Transnet.stopServer();
      await Transnet.stopDiscoveryService();
      reset();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleCancelReceive = async () => {
    try {
      await Transnet.cancelServerTransfer();
    } catch {}
    setIsReceiving(false);
    setProgress(null);
    setStatus('Transfer cancelled. Tap to try again.');
    setStep('ready');
  };

  const handleSkipFile = async () => {
    try {
      await Transnet.signalSkipCurrentFile();
    } catch {}
  };

  // ── Step: Ready ───────────────────────────────────────

  const renderReady = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepDescription}>Waiting to receive files from a nearby device</Text>

      <TouchableOpacity style={styles.primaryButton} onPress={startReceiving} activeOpacity={0.7}>
        <MaterialCommunityIcons name="radar" size={20} color={Colors.background} />
        <Text style={styles.primaryButtonText}>Start listening</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.linkButton} onPress={stopServices}>
        <Text style={styles.linkButtonText}>Stop all services</Text>
      </TouchableOpacity>
    </View>
  );

  // ── Step: Waiting ─────────────────────────────────────

  const renderWaiting = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepDescription}>Looking for nearby senders...</Text>

      <View style={styles.radarCenter}>
        <Radar active />
      </View>

      {isReceiving && progress && (
        <TransferProgressBar progress={progress} />
      )}

      {isReceiving && (
        <View style={styles.transferActions}>
          <TouchableOpacity style={styles.skipButton} onPress={handleSkipFile} activeOpacity={0.7}>
            <MaterialCommunityIcons name="skip-next" size={20} color={Colors.textMuted} />
            <Text style={styles.skipButtonText}>Skip file</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.stopButton} onPress={handleCancelReceive} activeOpacity={0.7}>
            <MaterialCommunityIcons name="stop-circle-outline" size={20} color={Colors.textMuted} />
            <Text style={styles.stopButtonText}>Stop</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.statusCard}>
        <ActivityIndicator color={Colors.accent} />
        <Text style={styles.statusText}>{status}</Text>
      </View>
    </View>
  );

  // ── Step: Done ────────────────────────────────────────

  const renderDone = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepDescription}>All done!</Text>

      <View style={styles.doneCard}>
        <MaterialCommunityIcons name="check-circle-outline" size={64} color={Colors.accent} />
        <Text style={styles.doneTitle}>Files received</Text>
        <Text style={styles.doneSubtitle}>
          {senderName ? `From ${senderName}` : 'Transfer complete'}
        </Text>
        <Text style={styles.donePath}>Saved to Android/data/com.anonymous.app/files/Download/TransNet</Text>
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={reset} activeOpacity={0.7}>
        <MaterialCommunityIcons name="restart" size={20} color={Colors.background} />
        <Text style={styles.primaryButtonText}>Receive again</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <StepIndicator totalSteps={3} currentStep={stepIndex} />

      {step === 'ready' && renderReady()}
      {step === 'waiting' && renderWaiting()}
      {step === 'done' && renderDone()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  stepContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 16,
    justifyContent: 'center',
  },
  stepDescription: {
    color: Colors.textMuted,
    fontSize: 16,
    marginBottom: 4,
  },

  // Radar
  radarCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radarWrap: {
    width: 220,
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radarRing: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: Colors.surfaceLight,
    borderRadius: 200,
  },
  ring1: { width: 90, height: 90 },
  ring2: { width: 155, height: 155 },
  ring3: { width: 220, height: 220 },
  radarSweep: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    borderTopColor: Colors.accent,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
    borderWidth: 2,
  },

  // Status
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  statusText: {
    color: Colors.textMuted,
    fontSize: 14,
  },

  // Done
  doneCard: {
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 32,
    gap: 8,
  },
  doneTitle: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 8,
  },
  doneSubtitle: {
    color: Colors.textMuted,
    fontSize: 15,
  },
  donePath: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 4,
    opacity: 0.6,
  },

  // Buttons
  primaryButton: {
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: {
    color: Colors.background,
    fontWeight: 'bold',
    fontSize: 16,
  },
  linkButton: {
    alignItems: 'center',
    padding: 12,
  },
  linkButtonText: {
    color: Colors.textMuted,
    fontSize: 13,
  },
  transferActions: {
    flexDirection: 'row',
    gap: 10,
  },
  skipButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.surfaceLight,
    gap: 8,
  },
  skipButtonText: {
    color: Colors.textMuted,
    fontWeight: '600',
    fontSize: 14,
  },
  stopButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    gap: 8,
  },
  stopButtonText: {
    color: Colors.textMuted,
    fontWeight: '600',
    fontSize: 14,
  },
});
