import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  BellRing,
  ChartPie,
  Inbox,
  Mic,
  PauseCircle,
  Plus,
  Receipt,
  TrendingDown,
  TrendingUp,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useCaptureStatus } from '../capture/CaptureProvider';
import { countDrafts, listConfirmed, sumDebits } from '../db/repository';
import {
  dayRange,
  formatDateTime,
  monthLabel,
  monthRange,
  shiftMonth,
} from '../domain/dates';
import { formatPaise } from '../domain/money';
import type { RootStackParamList, TabParamList } from '../navigation/types';
import {
  AmountText,
  Button,
  CategoryBadge,
  Divider,
  Empty,
  GlassCard,
  HeroCard,
  IconBadge,
  IconButton,
  ListRow,
  Screen,
  SectionTitle,
} from '../ui/components';
import { alpha, radius, spacing, type, useTheme } from '../ui/theme';
import { useDbQuery } from '../ui/useDbQuery';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const t = useTheme();
  const status = useCaptureStatus();
  const now = new Date();
  const [todayFrom, todayTo] = dayRange(now);
  const [monthFrom, monthTo] = monthRange(now.getFullYear(), now.getMonth());
  const prev = shiftMonth(now.getFullYear(), now.getMonth(), -1);
  const [prevFrom] = monthRange(prev.year, prev.month);
  // Same point in last month, so the comparison is fair mid-month.
  const prevSameDay = Math.min(prevFrom + (Date.now() - monthFrom), monthFrom);

  const today = useDbQuery(() => sumDebits(todayFrom, todayTo), [todayFrom]);
  const month = useDbQuery(() => sumDebits(monthFrom, monthTo), [monthFrom]);
  const lastMonthToDate = useDbQuery(
    () => sumDebits(prevFrom, prevSameDay),
    [prevFrom, todayFrom],
  );
  const drafts = useDbQuery(countDrafts, []);
  const recent = useDbQuery(
    () => listConfirmed({ from: monthFrom - 60 * 864e5, to: todayTo }),
    [monthFrom, todayTo],
  );

  const current = month.data ?? 0;
  const previous = lastMonthToDate.data ?? 0;
  const change =
    previous > 0 ? Math.round(((current - previous) / previous) * 100) : null;
  const pending = drafts.data ?? 0;

  return (
    <Screen
      tabs
      subtitle={greeting()}
      title="Your money"
      right={
        <IconButton
          icon={Mic}
          label="Add expense by voice"
          onPress={() => navigation.navigate('AddTransaction', { voice: true })}
        />
      }
    >
      {status.permissionGranted === false && (
        <GlassCard strong>
          <ListRow
            icon={BellRing}
            iconColor={t.warning}
            title="Capture is not running"
            subtitle="Allow notification access so payments are logged automatically."
          />
          <Button label="Allow access" compact onPress={status.openSettings} />
        </GlassCard>
      )}
      {status.captureEnabled === false && (
        <GlassCard strong>
          <ListRow
            icon={PauseCircle}
            iconColor={t.warning}
            title="Capture is paused"
            subtitle="Turn it back on in Settings to log payments automatically."
            onPress={() => navigation.navigate('Settings')}
            chevron
          />
        </GlassCard>
      )}

      <HeroCard>
        <Text style={[type.overline, styles.heroLabel]}>
          Spent in {monthLabel(now.getFullYear(), now.getMonth())}
        </Text>
        <AmountText
          paise={current}
          direction="debit"
          size="xl"
          color="#FFFFFF"
        />
        {change !== null ? (
          <View style={styles.heroTrend}>
            {change > 0 ? (
              <TrendingUp size={16} color="#FFFFFF" strokeWidth={2.5} />
            ) : (
              <TrendingDown size={16} color="#FFFFFF" strokeWidth={2.5} />
            )}
            <Text style={styles.heroTrendText}>
              {Math.abs(change)}% {change > 0 ? 'more' : 'less'} than this point
              last month
            </Text>
          </View>
        ) : null}
        <View style={styles.heroStats}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>Today</Text>
            <Text style={styles.heroStatValue}>
              {formatPaise(today.data ?? 0)}
            </Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>To review</Text>
            <Text style={styles.heroStatValue}>{pending}</Text>
          </View>
        </View>
      </HeroCard>

      {pending > 0 && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Review ${pending} new payments`}
          onPress={() => navigation.navigate('Inbox')}
          style={({ pressed }) => [
            styles.reviewCard,
            {
              backgroundColor: alpha(t.primary, t.dark ? 0.18 : 0.1),
              borderColor: alpha(t.primary, 0.3),
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <IconBadge icon={Inbox} color={t.primary} solid size={40} />
          <View style={styles.flex}>
            <Text style={[type.label, { color: t.text }]}>
              {pending} new {pending === 1 ? 'payment' : 'payments'} to review
            </Text>
            <Text style={[type.caption, { color: t.textMuted }]}>
              Swipe to confirm in seconds
            </Text>
          </View>
          <Text style={[type.label, { color: t.primary }]}>Review</Text>
        </Pressable>
      )}

      <View style={styles.actions}>
        <QuickAction
          icon={Plus}
          label="Add"
          color={t.primary}
          onPress={() => navigation.navigate('AddTransaction')}
        />
        <QuickAction
          icon={Mic}
          label="Voice"
          color="#14B8A6"
          onPress={() => navigation.navigate('AddTransaction', { voice: true })}
        />
        <QuickAction
          icon={ChartPie}
          label="Insights"
          color="#EC4899"
          onPress={() => navigation.navigate('Overview')}
        />
      </View>

      <SectionTitle
        action={{
          label: 'See all',
          onPress: () => navigation.navigate('Overview'),
        }}
      >
        Recent
      </SectionTitle>
      <GlassCard>
        {(recent.data ?? []).length === 0 ? (
          <Empty
            icon={Receipt}
            title="No expenses yet"
            message="Make a UPI payment or add one by hand. Confirmed expenses show up here."
          />
        ) : (
          (recent.data ?? []).slice(0, 6).map((tx, index) => (
            <View key={tx.id}>
              {index > 0 && <Divider />}
              <ListRow
                leading={<CategoryBadge id={tx.categoryId} size={40} />}
                title={tx.merchantName ?? 'Unknown payee'}
                subtitle={formatDateTime(tx.occurredAt)}
                right={
                  <AmountText paise={tx.amountPaise} direction={tx.direction} />
                }
                accessibilityLabel={`${
                  tx.merchantName ?? 'Unknown'
                }, ${formatPaise(tx.amountPaise)}. Edit`}
                onPress={() =>
                  navigation.navigate('EditTransaction', { id: tx.id })
                }
              />
            </View>
          ))
        )}
      </GlassCard>
    </Screen>
  );
}

function QuickAction({
  icon,
  label,
  color,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  color: string;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        {
          backgroundColor: t.glass,
          borderColor: t.glassBorder,
          transform: [{ scale: pressed ? 0.96 : 1 }],
        },
      ]}
    >
      <IconBadge icon={icon} color={color} size={42} />
      <Text style={[type.caption, styles.actionLabel, { color: t.text }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  heroLabel: { color: 'rgba(255,255,255,0.8)', marginBottom: spacing.xs },
  heroTrend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: spacing.sm,
  },
  heroTrendText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  heroStats: {
    flexDirection: 'row',
    marginTop: spacing.xl,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  heroStat: { flex: 1, alignItems: 'center' },
  heroStatLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontWeight: '600',
  },
  heroStatValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  heroDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.25)' },
  reviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  actions: { flexDirection: 'row', gap: spacing.md },
  action: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingVertical: spacing.lg,
  },
  actionLabel: { fontWeight: '700' },
});
