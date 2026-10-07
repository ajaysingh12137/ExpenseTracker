import React, { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import {
  getCaptureConfig,
  resetCaptureConfig,
  setAllowedPackages,
  setSmsPackages,
} from '../capture/transactionCapture';
import { Body, Button, Field, Screen, SectionTitle } from '../ui/components';

const toLines = (values: ReadonlyArray<string>) => values.join('\n');
const fromLines = (text: string) =>
  text
    .split(/[\n,]+/)
    .map(s => s.trim())
    .filter(Boolean);

/**
 * Advanced: the package allowlists. Defaults ship unverified (see CaptureConfig.kt); this screen
 * lets them be corrected on a device without an app update.
 */
export function CaptureSourcesScreen() {
  const [apps, setApps] = useState('');
  const [sms, setSms] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const config = await getCaptureConfig();
    setApps(toLines(config?.packages ?? []));
    setSms(toLines(config?.smsPackages ?? []));
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    setBusy(true);
    await setAllowedPackages(fromLines(apps));
    await setSmsPackages(fromLines(sms));
    await load(); // shows what survived validation
    setBusy(false);
    Alert.alert('Saved', 'Invalid package names, if any, were removed.');
  };

  const reset = async () => {
    await resetCaptureConfig();
    await load();
  };

  return (
    <Screen>
      <Body muted>
        Android package names, one per line. Only notifications from these apps
        are ever read. To find a name: Play Store page URL (id=…) or `adb shell
        pm list packages`.
      </Body>
      <SectionTitle>Bank and UPI apps</SectionTitle>
      <Field
        label="Package names"
        value={apps}
        onChangeText={setApps}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
      />
      <SectionTitle>SMS apps (used only if bank SMS is on)</SectionTitle>
      <Field
        label="Package names"
        value={sms}
        onChangeText={setSms}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Button label="Save" onPress={save} busy={busy} />
      <Button
        label="Restore defaults"
        variant="secondary"
        onPress={reset}
        disabled={busy}
      />
    </Screen>
  );
}
