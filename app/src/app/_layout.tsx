import { useEffect } from 'react';
import { AppState, View } from 'react-native';
import { Tabs, TabList, TabTrigger, TabSlot } from 'expo-router/ui';
import Transnet from '../../modules/transnet/src/TransnetModule';
import { CustomTabBar } from '../components/CustomTabBar';
import { Colors } from '../constants/theme';

export default function TabLayout() {
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
    </View>
  );
}
