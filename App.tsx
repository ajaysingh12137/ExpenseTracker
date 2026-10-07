import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  AppState,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CaptureProvider } from './src/capture/CaptureProvider';
import { countDrafts } from './src/db/repository';
import { getSetting, SettingKeys } from './src/db/settings';
import type { RootStackParamList, TabParamList } from './src/navigation/types';
import { AddTransactionScreen } from './src/screens/AddTransactionScreen';
import { BatteryGuideScreen } from './src/screens/BatteryGuideScreen';
import { CaptureSourcesScreen } from './src/screens/CaptureSourcesScreen';
import { CategoryTransactionsScreen } from './src/screens/CategoryTransactionsScreen';
import { EditTransactionScreen } from './src/screens/EditTransactionScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { InboxScreen } from './src/screens/InboxScreen';
import { LockScreen } from './src/screens/LockScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { OverviewScreen } from './src/screens/OverviewScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { useAppStore } from './src/state/store';
import { useTheme } from './src/ui/theme';
import { useDbQuery } from './src/ui/useDbQuery';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

/** Re-lock when the app has been in the background longer than this. */
const RELOCK_AFTER_MS = 60 * 1000;

const tabIcon = (glyph: string) => () =>
  <Text style={styles.tabIcon}>{glyph}</Text>;

function Tabs() {
  const drafts = useDbQuery(countDrafts, []);
  return (
    <Tab.Navigator screenOptions={{ headerTitleAlign: 'left' }}>
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: 'Home', tabBarIcon: tabIcon('🏠') }}
      />
      <Tab.Screen
        name="Inbox"
        component={InboxScreen}
        options={{
          title: 'Inbox',
          tabBarIcon: tabIcon('📥'),
          tabBarBadge: drafts.data ? drafts.data : undefined,
        }}
      />
      <Tab.Screen
        name="Overview"
        component={OverviewScreen}
        options={{ title: 'Overview', tabBarIcon: tabIcon('📊') }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Settings', tabBarIcon: tabIcon('⚙️') }}
      />
    </Tab.Navigator>
  );
}

function MainApp() {
  return (
    <CaptureProvider>
      <Stack.Navigator>
        <Stack.Screen
          name="Tabs"
          component={Tabs}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="EditTransaction"
          component={EditTransactionScreen}
          options={{ title: 'Edit expense' }}
        />
        <Stack.Screen
          name="AddTransaction"
          component={AddTransactionScreen}
          options={{ title: 'Add expense' }}
        />
        <Stack.Screen
          name="CategoryTransactions"
          component={CategoryTransactionsScreen}
          options={({ route }) => ({ title: route.params.name })}
        />
        <Stack.Screen
          name="CaptureSources"
          component={CaptureSourcesScreen}
          options={{ title: 'Apps to read from' }}
        />
        <Stack.Screen
          name="BatteryGuide"
          component={BatteryGuideScreen}
          options={{ title: 'Battery settings' }}
        />
      </Stack.Navigator>
    </CaptureProvider>
  );
}

function Root() {
  const t = useTheme();
  const onboarded = useAppStore(s => s.onboarded);
  const appLockEnabled = useAppStore(s => s.appLockEnabled);
  const unlocked = useAppStore(s => s.unlocked);
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    (async () => {
      const store = useAppStore.getState();
      const lock = (await getSetting(SettingKeys.appLock)) === '1';
      store.setAppLockEnabled(lock);
      store.setUnlocked(!lock);
      store.setOnboarded((await getSetting(SettingKeys.onboarded)) === '1');
    })().catch(() => useAppStore.getState().setOnboarded(false));
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      const store = useAppStore.getState();
      if (state === 'background') {
        backgroundedAt.current = Date.now();
      } else if (state === 'active' && backgroundedAt.current !== null) {
        if (
          store.appLockEnabled &&
          Date.now() - backgroundedAt.current > RELOCK_AFTER_MS
        ) {
          store.setUnlocked(false);
        }
        backgroundedAt.current = null;
      }
    });
    return () => sub.remove();
  }, []);

  if (onboarded === null) {
    return (
      <View style={[styles.center, { backgroundColor: t.bg }]}>
        <ActivityIndicator color={t.primary} />
      </View>
    );
  }
  if (!onboarded) {
    return <OnboardingScreen />;
  }
  if (appLockEnabled && !unlocked) {
    return <LockScreen />;
  }
  return <MainApp />;
}

export default function App() {
  const t = useTheme();
  const base = t.dark ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: t.primary,
      background: t.bg,
      card: t.surface,
      text: t.text,
      border: t.border,
    },
  };
  return (
    <SafeAreaProvider>
      <StatusBar barStyle={t.dark ? 'light-content' : 'dark-content'} />
      <NavigationContainer theme={navTheme}>
        <Root />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabIcon: { fontSize: 20 },
});
