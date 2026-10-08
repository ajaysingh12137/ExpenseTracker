import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Activity,
  BatteryCharging,
  BellRing,
  CircleCheck,
  CircleX,
  MessageSquareText,
  PlugZap,
  RotateCcw,
  Zap,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, StyleSheet, Text, View } from 'react-native';
import { useCaptureStatus } from '../capture/CaptureProvider';
import { sourceIcon, sourceLabel } from '../capture/sourceLabels';
import { useReconnectWithFeedback } from '../capture/useReconnect';
import {
  getCaptureConfig,
  getCaptureHealth,
  resetCaptureStats,
} from '../capture/transactionCapture';
import type {
  CaptureConfig,
  CaptureHealth,
  CaptureSourceStat,
} from '../capture/transactionCapture';
import { isIgnoringBatteryOptimizations } from '../device/deviceServices';
import { formatDateTime } from '../domain/dates';
import type { RootStackParamList } from '../navigation/types';
import {
  Body,
  Button,
  Chip,
  Divider,
  GlassCard,
  IconBadge,
  ListRow,
  Screen,
  SectionTitle,
} from '../ui/components';
import { spacing, type, useTheme } from '../ui/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function ago(ms: number): string {
  if (!ms) {
    return 'never';
  }
  const minutes = Math.round((Date.now() - ms) / 60000);
  if (minutes < 1) {
    return 'just now';
  }
  if (minutes < 60) {
    return `${minutes} min ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours} h ago`;
  }
  return formatDateTime(ms);
}

function Check({
  ok,
  title,
  detail,
}: {
  ok: boolean;
  title: string;
  detail: string;
}) {
  const t = useTheme();
  return (
    <ListRow
      icon={ok ? CircleCheck : CircleX}
      iconColor={ok ? t.credit : t.warning}
      title={title}
      subtitle={detail}
    />
  );
}

/**
 * "Is everything being captured?" Shows the listener's state and, per source app, how many
 * alerts arrived and why any were skipped. Counts only: no notification text is stored for
 * this screen.
 */
export function CaptureHealthScreen() {
  const navigation = useNavigation<Nav>();
  const t = useTheme();
  const status = useCaptureStatus();
  const [health, setHealth] = useState<CaptureHealth | null>(null);
  const [config, setConfig] = useState<CaptureConfig | null>(null);
  const [battery, setBattery] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    setHealth(await getCaptureHealth());
    setConfig(await getCaptureConfig());
    setBattery(await isIgnoringBatteryOptimizations());
  }, []);

  useEffect(() => {
    load();
    const sub = AppState.addEventListener(
      'change',
      s => s === 'active' && load(),
    );
    return () => sub.remove();
  }, [load]);

  const feedback = useReconnectWithFeedback({
    onOpenBatterySettings: () => navigation.navigate('BatteryGuide'),
  });
  const reconnect = async () => {
    await feedback.reconnect();
    await load();
  };

  const allowed = new Set([
    ...(config?.packages ?? []),
    ...(config?.smsAppsEnabled ? config?.smsPackages ?? [] : []),
  ]);
  const seenSources = health?.sources ?? [];
  const silent = [...allowed].filter(
    p => !seenSources.some(s => s.packageName === p),
  );

  const listenerDetail = health?.listenerConnected
    ? `Connected ${ago(health.connectedAt)}`
    : `Not connected${
        health?.disconnectedAt ? ` since ${ago(health.disconnectedAt)}` : ''
      }`;

  return (
    <Screen
      onBack={navigation.goBack}
      title="Capture health"
      subtitle="Is everything being caught?"
    >
      <GlassCard>
        <Check
          ok={!!health?.permissionGranted}
          title="Notification access"
          detail={
            health?.permissionGranted
              ? 'Allowed'
              : 'Off: nothing can be captured'
          }
        />
        <Divider />
        <Check
          ok={!!health?.listenerConnected}
          title="Listener connected"
          detail={listenerDetail}
        />
        <Divider />
        <Check
          ok={!!config?.captureEnabled}
          title="Capture switched on"
          detail={config?.captureEnabled ? 'On' : 'Paused in Settings'}
        />
        <Divider />
        {health?.powerSaveMode ? (
          <>
            <Check
              ok={false}
              title="Battery Saver is on"
              detail="It can stop capture in the background. Charge or turn it off."
            />
            <Divider />
          </>
        ) : null}
        <Check
          ok={!!battery}
          title="Battery optimization off"
          detail={
            battery
              ? 'Android will not pause capture'
              : 'Android may stop capture in the background'
          }
        />
        {health?.permissionGranted === false && (
          <Button
            label="Allow notification access"
            icon={BellRing}
            compact
            onPress={status.openSettings}
          />
        )}
        {health?.permissionGranted && !health.listenerConnected && (
          <Button
            label={
              feedback.reconnecting ? 'Reconnecting…' : 'Reconnect listener'
            }
            icon={PlugZap}
            compact
            busy={feedback.reconnecting}
            onPress={reconnect}
          />
        )}
        {battery === false && (
          <Button
            label="Battery settings"
            icon={BatteryCharging}
            variant="secondary"
            compact
            onPress={() => navigation.navigate('BatteryGuide')}
          />
        )}
      </GlassCard>

      <SectionTitle
        action={{
          label: 'Reset counts',
          onPress: () =>
            Alert.alert(
              'Reset counts?',
              'Starts the per-app counts from zero.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Reset',
                  onPress: async () => {
                    await resetCaptureStats();
                    await load();
                  },
                },
              ],
            ),
        }}
      >
        {health?.statsSince
          ? `Alerts since ${formatDateTime(health.statsSince)}`
          : 'Alerts per app'}
      </SectionTitle>
      <GlassCard>
        {seenSources.length === 0 ? (
          <ListRow
            icon={Activity}
            iconColor={t.textMuted}
            title="No alerts yet"
            subtitle="Make a small UPI payment. The app that notifies you will appear here."
          />
        ) : (
          seenSources.map((source, index) => (
            <View key={source.packageName}>
              {index > 0 && <Divider />}
              <SourceRow source={source} />
            </View>
          ))
        )}
      </GlassCard>

      {silent.length > 0 && (
        <>
          <SectionTitle>Not heard from yet</SectionTitle>
          <GlassCard>
            {silent.map((pkg, index) => (
              <View key={pkg}>
                {index > 0 && <Divider />}
                <ListRow
                  icon={sourceIcon(pkg)}
                  iconColor={t.textSubtle}
                  title={sourceLabel(pkg)}
                  subtitle="On the list, but no alert seen. Fine if you don't use this app."
                />
              </View>
            ))}
          </GlassCard>
        </>
      )}

      <SectionTitle>If a payment was missed</SectionTitle>
      <GlassCard>
        <ListRow
          icon={MessageSquareText}
          iconColor="#0EA5E9"
          title="Bank sent only an SMS?"
          subtitle={
            config?.smsAppsEnabled
              ? 'Bank SMS capture is on. Check your SMS app is in "Apps to read from".'
              : 'Many banks alert by SMS only. Turn on "Bank SMS alerts" in Settings.'
          }
        />
        <Divider />
        <ListRow
          icon={Zap}
          iconColor={t.primary}
          title="App not on the list?"
          subtitle='Add your bank or UPI app in Settings → "Apps to read from".'
          onPress={() => navigation.navigate('CaptureSources')}
          chevron
        />
        <Divider />
        <ListRow
          icon={RotateCcw}
          iconColor={t.warning}
          title="Notifications turned off for that app?"
          subtitle="If the bank or UPI app's own notifications are silenced in Android settings, there is nothing to capture."
        />
        <Body muted>
          Anything missed can always be added with + or by voice.
        </Body>
      </GlassCard>
    </Screen>
  );
}

function SourceRow({ source }: { source: CaptureSourceStat }) {
  const t = useTheme();
  const skipped = source.droppedOtp + source.droppedOther;
  return (
    <View style={styles.source}>
      <View style={styles.sourceHead}>
        <IconBadge
          icon={sourceIcon(source.packageName)}
          color={t.primary}
          size={38}
        />
        <View style={styles.flex}>
          <Text style={[type.label, { color: t.text }]} numberOfLines={1}>
            {sourceLabel(source.packageName)}
          </Text>
          <Text style={[type.caption, { color: t.textMuted }]}>
            Last alert {ago(source.lastSeenAt)} · last payment{' '}
            {ago(source.lastCapturedAt)}
          </Text>
        </View>
      </View>
      <View style={styles.chips}>
        <Chip label={`${source.captured} captured`} tone="success" />
        {source.duplicate > 0 && (
          <Chip label={`${source.duplicate} repeats merged`} />
        )}
        {source.droppedOtp > 0 && (
          <Chip label={`${source.droppedOtp} OTPs discarded`} />
        )}
        {source.droppedOther > 0 && (
          <Chip label={`${source.droppedOther} not payments`} />
        )}
        {skipped === 0 && source.captured === 0 && (
          <Chip label={`${source.seen} seen`} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  source: { paddingVertical: spacing.sm, gap: spacing.sm },
  sourceHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingLeft: 50,
  },
});
