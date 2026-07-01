import React, { useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import { Colors } from '../constants/theme';
import { useMenu } from './MenuContext';

export const HamburgerMenu = () => {
  const { menuOpen, setMenuOpen, setFilesPageOpen } = useMenu();
  const translateX = useSharedValue(-280);
  const overlayOpacity = useSharedValue(0);

  useEffect(() => {
    translateX.value = withTiming(menuOpen ? 0 : -280, {
      duration: 250,
      easing: Easing.out(Easing.quad),
    });
    overlayOpacity.value = withTiming(menuOpen ? 0.5 : 0, { duration: 250 });
  }, [menuOpen]);

  const menuStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const openFiles = () => {
    setMenuOpen(false);
    setTimeout(() => setFilesPageOpen(true), 180);
  };

  return (
    <>
      {menuOpen && (
        <Pressable style={styles.overlay} onPress={() => setMenuOpen(false)}>
          <Animated.View style={[styles.overlayBg, overlayStyle]} />
        </Pressable>
      )}

      <Animated.View style={[styles.menu, menuStyle]}>
        <View style={styles.menuHeader}>
          <Text style={styles.menuTitle}>Menu</Text>
          <TouchableOpacity onPress={() => setMenuOpen(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <MaterialCommunityIcons name="close" size={22} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.menuItem} onPress={openFiles} activeOpacity={0.6}>
          <MaterialCommunityIcons name="folder-download-outline" size={22} color={Colors.accent} />
          <Text style={styles.menuItemLabel}>Received files</Text>
          <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.textMuted} style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>
      </Animated.View>
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 90,
  },
  overlayBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.background,
  },
  menu: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 280,
    backgroundColor: Colors.background,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    zIndex: 100,
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  menuTitle: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: 'bold',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  menuItemLabel: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '500',
  },
});
