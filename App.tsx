import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Appearance,
  AppState,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CaptureProvider } from './src/capture/CaptureProvider';
import { countDrafts } from './src/db/repository';
import { getSetting, SettingKeys } from './src/db/settings';
import { getThemeMode, hideSplash } from './src/device/deviceServices';
import type { RootStackParamList, TabParamList } from './src/navigation/types';
import { AddTransactionScreen } from './src/screens/AddTransactionScreen';
import { BatteryGuideScreen } from './src/screens/BatteryGuideScreen';
import { CaptureHealthScreen } from './src/screens/CaptureHealthScreen';
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
import { BrandIntro } from './src/ui/BrandMark';
import { AppBackground } from './src/ui/components';
import { GlassTabBar } from './src/ui/GlassTabBar';
import { useTheme } from './src/ui/theme';
import { useDbQuery } from './src/ui/useDbQuery';

const Stack = createNativeStackNavigator<RootStackParamList>();
const renderTabBar = (props: BottomTabBarProps) => <GlassTabBar {...props} />;
const Tab = createBottomTabNavigator<TabParamList>();

/** Re-lock when the app has been in the background longer than this. */
const RELOCK_AFTER_MS = 60 * 1000;

function Tabs() {
  const drafts = useDbQuery(countDrafts, []);
  return (
    <Tab.Navigator
      // Screens draw their own headers; the bar floats over content (see GlassTabBar).
      screenOptions={{ headerShown: false }}
      tabBar={renderTabBar}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: 'Home' }}
      />
      <Tab.Screen
        name="Inbox"
        component={InboxScreen}
        options={{
          title: 'Inbox',
          tabBarBadge: drafts.data ? drafts.data : undefined,
        }}
      />
      <Tab.Screen
        name="Overview"
        component={OverviewScreen}
        options={{ title: 'Insights' }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Settings' }}
      />
    </Tab.Navigator>
  );
}

function MainApp() {
  return (
    <CaptureProvider>
      <Stack.Navigator
        screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
      >
        <Stack.Screen name="Tabs" component={Tabs} />
        <Stack.Screen
          name="EditTransaction"
          component={EditTransactionScreen}
        />
        <Stack.Screen
          name="AddTransaction"
          component={AddTransactionScreen}
          options={{ animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="CategoryTransactions"
          component={CategoryTransactionsScreen}
        />
        <Stack.Screen name="CaptureSources" component={CaptureSourcesScreen} />
        <Stack.Screen name="CaptureHealth" component={CaptureHealthScreen} />
        <Stack.Screen name="BatteryGuide" component={BatteryGuideScreen} />
      </Stack.Navigator>
    </CaptureProvider>
  );
}

function Root() {
  const onboarded = useAppStore(s => s.onboarded);
  const appLockEnabled = useAppStore(s => s.appLockEnabled);
  const unlocked = useAppStore(s => s.unlocked);
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    (async () => {
      const store = useAppStore.getState();
      // Native already applied the saved theme; mirror it in JS before the splash lifts.
      const mode = await getThemeMode();
      if (mode !== 'system') {
        Appearance.setColorScheme(mode);
      }
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

  // Cold-start brand intro: takes over from the native splash, then reveals the app.
  const [introDone, setIntroDone] = useState(false);
  const releaseNativeSplash = useCallback(() => hideSplash(), []);
  const finishIntro = useCallback(() => setIntroDone(true), []);

  let screen: React.ReactNode;
  if (onboarded === null) {
    screen = <AppBackground />;
  } else if (!onboarded) {
    screen = <OnboardingScreen />;
  } else if (appLockEnabled && !unlocked) {
    screen = <LockScreen />;
  } else {
    screen = <MainApp />;
  }

  return (
    <View style={styles.root}>
      {screen}
      {!introDone && (
        <BrandIntro
          ready={onboarded !== null}
          onFirstFrame={releaseNativeSplash}
          onDone={finishIntro}
        />
      )}
    </View>
  );
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
      card: t.bg,
      text: t.text,
      border: t.hairline,
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
  root: { flex: 1 },
});
