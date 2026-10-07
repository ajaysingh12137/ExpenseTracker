import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useCaptureStatus } from '../capture/CaptureProvider';
import {
  countDrafts,
  getCategories,
  listConfirmed,
  sumDebits,
} from '../db/repository';
import { dayRange, formatDateTime, monthRange } from '../domain/dates';
import { formatPaise } from '../domain/money';
import type { RootStackParamList, TabParamList } from '../navigation/types';
import {
  Amount,
  Body,
  Button,
  Card,
  SectionTitle,
  Screen,
} from '../ui/components';
import { spacing, useTheme } from '../ui/theme';
import { useDbQuery } from '../ui/useDbQuery';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const t = useTheme();
  const status = useCaptureStatus();
  const now = new Date();
  const [todayFrom, todayTo] = dayRange(now);
  const [monthFrom, monthTo] = monthRange(now.getFullYear(), now.getMonth());

  const today = useDbQuery(() => sumDebits(todayFrom, todayTo), [todayFrom]);
  const month = useDbQuery(() => sumDebits(monthFrom, monthTo), [monthFrom]);
  const drafts = useDbQuery(countDrafts, []);
  const recent = useDbQuery(
    () => listConfirmed({ from: monthFrom - 60 * 864e5, to: todayTo }),
    [monthFrom, todayTo],
  );
  const categories = useDbQuery(getCategories, []);

  return (
    <Screen>
      {status.permissionGranted === false && (
        <Card style={{ borderColor: t.warning }}>
          <Body>
            ⚠️ Notification access is off, so payments are not being captured.
          </Body>
          <Button label="Turn it on" onPress={status.openSettings} />
        </Card>
      )}
      {status.captureEnabled === false && (
        <Card style={{ borderColor: t.warning }}>
          <Body>
            Capture is paused. Turn it on in Settings to log payments
            automatically.
          </Body>
        </Card>
      )}
      <View style={styles.totals}>
        <Card style={styles.flex}>
          <Text style={[styles.label, { color: t.textMuted }]}>
            Spent today
          </Text>
          <Text style={[styles.total, { color: t.text }]}>
            {formatPaise(today.data ?? 0)}
          </Text>
        </Card>
        <Card style={styles.flex}>
          <Text style={[styles.label, { color: t.textMuted }]}>This month</Text>
          <Text style={[styles.total, { color: t.text }]}>
            {formatPaise(month.data ?? 0)}
          </Text>
        </Card>
      </View>
      <Text style={[styles.note, { color: t.textMuted }]}>
        Totals include confirmed expenses only.
      </Text>

      {(drafts.data ?? 0) > 0 && (
        <Button
          label={`Review ${drafts.data} new ${
            drafts.data === 1 ? 'payment' : 'payments'
          }`}
          onPress={() => navigation.navigate('Inbox')}
        />
      )}
      <View style={styles.actions}>
        <View style={styles.flex}>
          <Button
            label="+ Add expense"
            variant="secondary"
            onPress={() => navigation.navigate('AddTransaction')}
          />
        </View>
        <View style={styles.flex}>
          <Button
            label="🎤 Voice"
            variant="secondary"
            onPress={() =>
              navigation.navigate('AddTransaction', { voice: true })
            }
          />
        </View>
      </View>

      <SectionTitle>Recent</SectionTitle>
      {(recent.data ?? []).length === 0 ? (
        <Body muted>Confirmed expenses will show here.</Body>
      ) : (
        (recent.data ?? []).slice(0, 8).map(tx => {
          const category = categories.data?.find(c => c.id === tx.categoryId);
          return (
            <Pressable
              key={tx.id}
              accessibilityRole="button"
              accessibilityLabel={`${
                tx.merchantName ?? 'Unknown'
              }, ${formatPaise(tx.amountPaise)}. Edit`}
              onPress={() =>
                navigation.navigate('EditTransaction', { id: tx.id })
              }
              style={[styles.row, { borderBottomColor: t.border }]}
            >
              <Text style={styles.icon}>{category?.icon ?? '❓'}</Text>
              <View style={styles.flex}>
                <Text
                  style={[styles.name, { color: t.text }]}
                  numberOfLines={1}
                >
                  {tx.merchantName ?? 'Unknown'}
                </Text>
                <Text style={[styles.meta, { color: t.textMuted }]}>
                  {formatDateTime(tx.occurredAt)}
                </Text>
              </View>
              <Amount paise={tx.amountPaise} direction={tx.direction} />
            </Pressable>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  totals: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
  label: { fontSize: 13 },
  total: { fontSize: 24, fontWeight: '700', marginTop: spacing.xs },
  note: { fontSize: 12, marginBottom: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  icon: { fontSize: 22, width: 40 },
  name: { fontSize: 16, fontWeight: '600' },
  meta: { fontSize: 13 },
});
