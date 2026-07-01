import { View, Pressable, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { TabTrigger, useTabTrigger } from 'expo-router/ui';
import { Colors } from '../constants/theme';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

function TabButton({ name, icon }: { name: string; icon: any }) {
  const { trigger } = useTabTrigger({ name });
  const isFocused = trigger?.isFocused ?? false;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(isFocused ? 1 : 0.8) }],
    opacity: withSpring(isFocused ? 1 : 0.6),
  }));

  return (
    <TabTrigger name={name} asChild>
      <Pressable style={styles.tabButton}>
        <Animated.View style={[styles.iconContainer, animatedStyle]}>
          <MaterialCommunityIcons
            name={icon}
            size={30}
            color={isFocused ? Colors.accent : Colors.textMuted}
          />
        </Animated.View>
      </Pressable>
    </TabTrigger>
  );
}

export const CustomTabBar = () => {
  return (
    <View style={styles.tabBar}>
      <TabButton name="index" icon="arrow-up-bold-circle-outline" />
      <TabButton name="receive" icon="arrow-down-bold-circle-outline" />
    </View>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    height: 80,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  tabButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
