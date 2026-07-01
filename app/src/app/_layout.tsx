import { useEffect } from 'react';
import { AppState, View, TouchableOpacity, StyleSheet } from 'react-native';
import { Tabs, TabList, TabTrigger, TabSlot } from 'expo-router/ui';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Transnet from '../../modules/transnet/src/TransnetModule';
import { CustomTabBar } from '../components/CustomTabBar';
import { HamburgerMenu } from '../components/HamburgerMenu';
import { ReceivedFilesPage } from '../components/ReceivedFilesPage';
import { MenuProvider, useMenu } from '../components/MenuContext';
import { Colors } from '../constants/theme';

function TabLayoutInner() {
  const { menuOpen, setMenuOpen, filesPageOpen, setFilesPageOpen } = useMenu();

  useEffect(() => {
    Transnet.initCore().catch(console.error);

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'background') {
        Transnet.stopDiscoveryService().catch(console.error);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <Tabs>
        <TabSlot />
        <TabList style={{ display: 'none' }}>
          <TabTrigger name="index" href="/" />
          <TabTrigger name="receive" href="/receive" />
        </TabList>
        <CustomTabBar />
      </Tabs>

      {!filesPageOpen && (
        <TouchableOpacity
          style={styles.hamburger}
          onPress={() => setMenuOpen(!menuOpen)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <MaterialCommunityIcons
            name={menuOpen ? 'close' : 'menu'}
            size={26}
            color={menuOpen ? Colors.accent : Colors.textMuted}
          />
        </TouchableOpacity>
      )}

      <HamburgerMenu />
      <ReceivedFilesPage visible={filesPageOpen} onClose={() => setFilesPageOpen(false)} />
    </View>
  );
}

export default function TabLayout() {
  return (
    <MenuProvider>
      <TabLayoutInner />
    </MenuProvider>
  );
}

const styles = StyleSheet.create({
  hamburger: {
    position: 'absolute',
    top: 52,
    left: 16,
    zIndex: 80,
  },
});
