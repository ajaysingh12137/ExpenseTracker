import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Activity,
  BatteryCharging,
  BellRing,
  CloudOff,
  EyeOff,
  FingerprintPattern,
  LayoutGrid,
  MessageSquareText,
  Moon,
  Palette,
  ShieldCheck,
  Sparkles,
  Sun,
  SunMoon,
  Zap,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { isAiEnabled } from '../ai/aiFallback';
import { useCaptureStatus } from '../capture/CaptureProvider';
import {
  getCaptureConfig,
  setCaptureEnabled,
  setSmsAppsEnabled,
} from '../capture/transactionCapture';
import { deleteSetting, setSetting, SettingKeys } from '../db/settings';
import {
  authenticate,
  canUseAppLock,
  getThemeMode,
  setThemeMode,
} from '../device/deviceServices';
import type { ThemeMode } from '../device/deviceServices';
import type { RootStackParamList } from '../navigation/types';
import { useAppStore } from '../state/store';
import { BrandLockup } from '../ui/BrandMark';
import {
  Chip,
  Divider,
  GlassCard,
  ListRow,
  Screen,
  SectionTitle,
  Segmented,
  ToggleRow,
} from '../ui/components';
import { spacing, type, useTheme } from '../ui/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function SettingsScreen() {
  const navigation = useNavigation<Nav>();
  const t = useTheme();
  const status = useCaptureStatus();
  const appLockEnabled = useAppStore(s => s.appLockEnabled);
  const setAppLockEnabled = useAppStore(s => s.setAppLockEnabled);
  const [captureOn, setCaptureOn] = useState(false);
  const [smsOn, setSmsOn] = useState(false);
  const [lockAvailable, setLockAvailable] = useState(false);
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');

  const load = useCallback(async () => {
    const config = await getCaptureConfig();
    setCaptureOn(config?.captureEnabled ?? false);
    setSmsOn(config?.smsAppsEnabled ?? false);
    setLockAvailable(await canUseAppLock());
    setThemeModeState(await getThemeMode());
  }, []);

  const changeTheme = (mode: ThemeMode) => {
    setThemeModeState(mode);
    setThemeMode(mode).catch(() => {});
  };

  useEffect(() => {
    load();
  }, [load]);

  const toggleCapture = async (value: boolean) => {
    await setCaptureEnabled(value);
    if (value) {
      await setSetting(SettingKeys.consentAt, String(Date.now()));
    } else {
      await deleteSetting(SettingKeys.consentAt);
    }
    setCaptureOn(value);
    status.refresh();
  };

  const toggleSms = async (value: boolean) => {
    if (value) {
      Alert.alert(
        'Read bank SMS alerts?',
        'The app will also read notifications from your SMS app and keep only messages that look like a payment. OTPs and personal messages are checked on the phone and never stored.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Turn on',
            onPress: async () => {
              await setSmsAppsEnabled(true);
              await setSetting(SettingKeys.smsConsentAt, String(Date.now()));
              setSmsOn(true);
            },
          },
        ],
      );
      return;
    }
    await setSmsAppsEnabled(false);
    await deleteSetting(SettingKeys.smsConsentAt);
    setSmsOn(false);
  };

  const toggleLock = async (value: boolean) => {
    const ok = await authenticate(
      value ? 'Turn on app lock' : 'Turn off app lock',
      'Confirm it is you',
    );
    if (!ok) {
      return;
    }
    await setSetting(SettingKeys.appLock, value ? '1' : '0');
    setAppLockEnabled(value);
  };

  const access = status.permissionGranted;

  return (
    <Screen tabs title="Settings" subtitle="Capture, security and privacy">
      <SectionTitle>Capture</SectionTitle>
      <GlassCard>
        <ToggleRow
          icon={Zap}
          iconColor={t.primary}
          title="Automatic capture"
          subtitle="Read payment notifications. Turning off stops it immediately; saved expenses stay."
          value={captureOn}
          onChange={toggleCapture}
        />
        <Divider />
        <ToggleRow
          icon={MessageSquareText}
          iconColor="#0EA5E9"
          title="Bank SMS alerts"
          subtitle="Off by default. Keeps payment messages only."
          value={smsOn}
          onChange={toggleSms}
          disabled={!captureOn}
        />
        <Divider />
        <ListRow
          icon={BellRing}
          iconColor="#F59E0B"
          title="Notification access"
          subtitle="Required by Android to read payment alerts"
          right={
            access === null ? undefined : (
              <Chip
                label={access ? 'On' : 'Off'}
                tone={access ? 'success' : 'warning'}
              />
            )
          }
          onPress={status.openSettings}
          chevron
        />
        <Divider />
        <ListRow
          icon={LayoutGrid}
          iconColor="#8B5CF6"
          title="Apps to read from"
          subtitle="Bank, UPI and SMS app list"
          onPress={() => navigation.navigate('CaptureSources')}
          chevron
        />
        <Divider />
        <ListRow
          icon={Activity}
          iconColor="#14B8A6"
          title="Capture health"
          subtitle="See which apps are being read and anything skipped"
          onPress={() => navigation.navigate('CaptureHealth')}
          chevron
        />
        <Divider />
        <ListRow
          icon={BatteryCharging}
          iconColor="#22C55E"
          title="Battery settings"
          subtitle="Stop your phone from pausing capture"
          onPress={() => navigation.navigate('BatteryGuide')}
          chevron
        />
      </GlassCard>

      <SectionTitle>Appearance</SectionTitle>
      <GlassCard>
        <ListRow
          icon={Palette}
          iconColor="#8B5CF6"
          title="Theme"
          subtitle={
            themeMode === 'system'
              ? 'Follows your phone setting'
              : themeMode === 'dark'
              ? 'Always dark'
              : 'Always light'
          }
        />
        <Segmented
          options={[
            { value: 'system', label: 'Auto', icon: SunMoon },
            { value: 'light', label: 'Light', icon: Sun },
            { value: 'dark', label: 'Dark', icon: Moon },
          ]}
          value={themeMode}
          onChange={changeTheme}
        />
      </GlassCard>

      <SectionTitle>Security</SectionTitle>
      <GlassCard>
        <ToggleRow
          icon={FingerprintPattern}
          iconColor="#EC4899"
          title="App lock"
          subtitle={
            lockAvailable
              ? 'Fingerprint, face or phone PIN to open'
              : 'Set a screen lock on your phone to use this'
          }
          value={appLockEnabled}
          onChange={toggleLock}
          disabled={!lockAvailable && !appLockEnabled}
        />
      </GlassCard>

      <SectionTitle>Privacy</SectionTitle>
      <GlassCard>
        <ListRow
          icon={EyeOff}
          iconColor="#14B8A6"
          title="OTPs are never stored"
          subtitle="Codes and other apps' notifications are discarded on the phone."
        />
        <Divider />
        <ListRow
          icon={ShieldCheck}
          iconColor="#14B8A6"
          title="Numbers are masked"
          subtitle="Account and card numbers keep only their last 4 digits."
        />
        <Divider />
        <ListRow
          icon={CloudOff}
          iconColor="#14B8A6"
          title="Not in phone backups"
          subtitle="Your data stays on this phone."
        />
        <Divider />
        <ListRow
          icon={Sparkles}
          iconColor={t.primary}
          title="AI reading of unclear messages"
          subtitle={
            isAiEnabled()
              ? 'Masked text goes to our server only when the phone cannot read it.'
              : 'Not enabled in this build.'
          }
          right={
            <Chip
              label={isAiEnabled() ? 'On' : 'Off'}
              tone={isAiEnabled() ? 'primary' : 'neutral'}
            />
          }
        />
      </GlassCard>

      <View style={styles.footer}>
        <BrandLockup size={44} />
        <Text style={[type.caption, { color: t.textSubtle }]}>
          Version 0.0.1
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  footer: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.xl },
});
