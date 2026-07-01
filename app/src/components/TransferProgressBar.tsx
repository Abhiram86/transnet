import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import { Colors } from '../constants/theme';
import type { TransferProgress } from '../../modules/transnet/src/TransnetModule';

interface Props {
  progress: TransferProgress;
}

export const TransferProgressBar = ({ progress }: Props) => {
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withTiming(progress.percentDone, {
      duration: 200,
      easing: Easing.inOut(Easing.quad),
    });
  }, [progress.percentDone]);

  const animatedFillStyle = useAnimatedStyle(() => ({
    width: `${width.value}%`,
  }));

  return (
    <View style={styles.card}>
      <View style={styles.barBg}>
        <Animated.View style={[styles.barFill, animatedFillStyle]} />
      </View>
      <View style={styles.row}>
        <Text style={styles.idx}>({progress.currentFileIdx + 1}/{progress.totalFiles})</Text>
        <Text style={styles.name} numberOfLines={1}>{progress.currentFileName}</Text>
        <Text style={styles.pct}>{progress.percentDone.toFixed(0)}%</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  barBg: {
    height: 8,
    backgroundColor: Colors.surfaceLight,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: 8,
    backgroundColor: Colors.accent,
    borderRadius: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  idx: {
    color: Colors.textMuted,
    fontSize: 13,
  },
  name: {
    color: Colors.textMuted,
    fontSize: 13,
    flex: 1,
  },
  pct: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
});
