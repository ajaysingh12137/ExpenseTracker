import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Switch, View } from 'react-native';
import { isAiEnabled } from '../ai/aiFallback';
import { useCaptureStatus } from '../capture/CaptureProvider';
import {
  getCaptureConfig,
  setCaptureEnabled,
  setSmsAppsEnabled,
} from '../capture/transactionCapture';
import { deleteSetting, setSetting, SettingKeys } from '../db/settings';
import { authenticate, canUseAppLock } from '../device/deviceServices';
import type { RootStackParamList } from '../navigation/types';
import { useAppStore } from '../state/store';
import { Body, Button, Card, Screen, SectionTitle } from '../ui/components';
import { spacing, useTheme } from '../ui/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function ToggleRow({
  label,
  description,
  value,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const t = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.flex}>
        <Body>{label}</Body>
        {description ? <Body muted>{description}</Body> : null}
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: t.primary, false: t.border }}
      />
    </View>
  );
}

export function SettingsScreen() {
  const navigation = useNavigation<Nav>();
  const status = useCaptureStatus();
  const appLockEnabled = useAppStore(s => s.appLockEnabled);
  const setAppLockEnabled = useAppStore(s => s.setAppLockEnabled);
  const [captureOn, setCaptureOn] = useState(false);
  const [smsOn, setSmsOn] = useState(false);
  const [lockAvailable, setLockAvailable] = useState(false);

  const load = useCallback(async () => {
    const config = await getCaptureConfig();
    setCaptureOn(config?.captureEnabled ?? false);
    setSmsOn(config?.smsAppsEnabled ?? false);
    setLockAvailable(await canUseAppLock());
  }, []);

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

  return (
    <Screen>
      <SectionTitle>Capture</SectionTitle>
      <Card>
        <ToggleRow
          label="Capture payments automatically"
          description="Turning this off stops reading notifications immediately. Expenses already saved stay."
          value={captureOn}
          onChange={toggleCapture}
        />
        <ToggleRow
          label="Read bank SMS alerts"
          description="Off by default. Reads notifications from your SMS app and keeps payment messages only."
          value={smsOn}
          onChange={toggleSms}
          disabled={!captureOn}
        />
        <Body muted>
          Notification access:{' '}
          {status.permissionGranted
            ? 'on'
            : status.permissionGranted === false
            ? 'off'
            : '…'}
        </Body>
        <Button
          label="Notification access settings"
          variant="secondary"
          onPress={status.openSettings}
        />
        <Button
          label="Apps to read from"
          variant="secondary"
          onPress={() => navigation.navigate('CaptureSources')}
        />
        <Button
          label="Battery settings guide"
          variant="secondary"
          onPress={() => navigation.navigate('BatteryGuide')}
        />
      </Card>

      <SectionTitle>Security</SectionTitle>
      <Card>
        <ToggleRow
          label="App lock"
          description={
            lockAvailable
              ? 'Fingerprint, face or phone PIN to open the app.'
              : 'Set a screen lock on your phone to use this.'
          }
          value={appLockEnabled}
          onChange={toggleLock}
          disabled={!lockAvailable && !appLockEnabled}
        />
      </Card>

      <SectionTitle>Privacy</SectionTitle>
      <Card>
        <Body>• OTPs and verification codes are never stored.</Body>
        <Body>
          • Account and card numbers are cut to their last 4 digits before
          saving.
        </Body>
        <Body>
          • Your data stays on this phone and is excluded from phone backups.
        </Body>
        <Body>
          • AI reading of unclear messages:{' '}
          {isAiEnabled()
            ? 'on (masked text is sent to our server only when the phone cannot read it)'
            : 'off in this build'}
        </Body>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  flex: { flex: 1, marginRight: spacing.md },
});
