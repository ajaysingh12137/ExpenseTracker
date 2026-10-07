import { useNavigation } from '@react-navigation/native';
import {
  Info,
  Landmark,
  MessageSquareText,
  RotateCcw,
  Save,
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import {
  getCaptureConfig,
  resetCaptureConfig,
  setAllowedPackages,
  setSmsPackages,
} from '../capture/transactionCapture';
import {
  Button,
  Field,
  GlassCard,
  IconBadge,
  Screen,
  SectionTitle,
} from '../ui/components';
import { alpha, radius, spacing, type, useTheme } from '../ui/theme';

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
  const navigation = useNavigation();
  const t = useTheme();
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
    <Screen
      onBack={navigation.goBack}
      title="Apps to read from"
      subtitle="Advanced"
    >
      <View
        style={[
          styles.note,
          { backgroundColor: alpha(t.primary, t.dark ? 0.14 : 0.08) },
        ]}
      >
        <Info size={18} color={t.primary} />
        <Text style={[type.caption, styles.flex, { color: t.textMuted }]}>
          Android package names, one per line. Only notifications from these
          apps are ever read. Find a name in the app's Play Store link (id=…).
        </Text>
      </View>

      <SectionTitle>Bank and UPI apps</SectionTitle>
      <GlassCard>
        <View style={styles.cardHead}>
          <IconBadge icon={Landmark} color="#8B5CF6" size={36} />
          <Text style={[type.label, { color: t.text }]}>
            {apps.split('\n').filter(Boolean).length} apps
          </Text>
        </View>
        <Field
          label="Package names"
          value={apps}
          onChangeText={setApps}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
        />
      </GlassCard>

      <SectionTitle>SMS apps (only if bank SMS is on)</SectionTitle>
      <GlassCard>
        <View style={styles.cardHead}>
          <IconBadge icon={MessageSquareText} color="#0EA5E9" size={36} />
          <Text style={[type.label, { color: t.text }]}>
            {sms.split('\n').filter(Boolean).length} apps
          </Text>
        </View>
        <Field
          label="Package names"
          value={sms}
          onChangeText={setSms}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
        />
      </GlassCard>

      <Button label="Save" icon={Save} onPress={save} busy={busy} />
      <Button
        label="Restore defaults"
        icon={RotateCcw}
        variant="secondary"
        onPress={reset}
        disabled={busy}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  note: {
    flexDirection: 'row',
    gap: spacing.sm,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'flex-start',
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
});
