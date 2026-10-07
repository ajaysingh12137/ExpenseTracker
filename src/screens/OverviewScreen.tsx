import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ChartPie,
  ChevronLeft,
  ChevronRight,
  Store,
  TrendingDown,
  TrendingUp,
} from 'lucide-react-native';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { categoryTotals, sumDebits, topMerchants } from '../db/repository';
import type { CategoryTotal } from '../db/repository';
import { monthLabel, monthRange, shiftMonth } from '../domain/dates';
import { formatPaise } from '../domain/money';
import type { RootStackParamList } from '../navigation/types';
import { categoryVisual } from '../ui/categoryVisuals';
import {
  CategoryBadge,
  Chip,
  Divider,
  Empty,
  GlassCard,
  ListRow,
  Screen,
  SectionTitle,
} from '../ui/components';
import { alpha, radius, spacing, type, useTheme } from '../ui/theme';
import { useDbQuery } from '../ui/useDbQuery';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const DONUT = 180;
const STROKE = 22;

function Donut({
  data,
  total,
}: {
  data: ReadonlyArray<CategoryTotal>;
  total: number;
}) {
  const t = useTheme();
  const r = (DONUT - STROKE) / 2;
  const circumference = 2 * Math.PI * r;
  const gap = data.length > 1 ? 4 : 0;
  let offset = 0;
  return (
    <View
      style={styles.donutWrap}
      accessible
      accessibilityLabel={`Total ${formatPaise(total)}`}
    >
      <Svg width={DONUT} height={DONUT}>
        <G rotation={-90} origin={`${DONUT / 2}, ${DONUT / 2}`}>
          <Circle
            cx={DONUT / 2}
            cy={DONUT / 2}
            r={r}
            stroke={t.hairline}
            strokeWidth={STROKE}
            fill="none"
          />
          {data.map(item => {
            const length =
              (item.totalPaise / Math.max(total, 1)) * circumference;
            const segment = (
              <Circle
                key={item.categoryId}
                cx={DONUT / 2}
                cy={DONUT / 2}
                r={r}
                stroke={categoryVisual(item.categoryId).color}
                strokeWidth={STROKE}
                strokeLinecap="round"
                fill="none"
                strokeDasharray={`${Math.max(
                  length - gap,
                  0.01,
                )} ${circumference}`}
                strokeDashoffset={-offset}
              />
            );
            offset += length;
            return segment;
          })}
        </G>
      </Svg>
      <View style={styles.donutCenter} pointerEvents="none">
        <Text style={[type.caption, { color: t.textMuted }]}>Total spent</Text>
        <Text style={[type.h2, { color: t.text }]}>{formatPaise(total)}</Text>
      </View>
    </View>
  );
}

export function OverviewScreen() {
  const navigation = useNavigation<Nav>();
  const t = useTheme();
  const now = new Date();
  const [period, setPeriod] = useState({
    year: now.getFullYear(),
    month: now.getMonth(),
  });
  const previous = shiftMonth(period.year, period.month, -1);
  const [from, to] = monthRange(period.year, period.month);
  const [prevFrom, prevTo] = monthRange(previous.year, previous.month);
  const isCurrent =
    period.year === now.getFullYear() && period.month === now.getMonth();

  const total = useDbQuery(() => sumDebits(from, to), [from]);
  const prevTotal = useDbQuery(() => sumDebits(prevFrom, prevTo), [prevFrom]);
  const byCategory = useDbQuery(() => categoryTotals(from, to), [from]);
  const merchants = useDbQuery(() => topMerchants(from, to), [from]);

  const current = total.data ?? 0;
  const last = prevTotal.data ?? 0;
  const change = last > 0 ? Math.round(((current - last) / last) * 100) : null;
  const categories = byCategory.data ?? [];
  const max = Math.max(1, ...categories.map(c => c.totalPaise));

  const monthSwitcher = (
    <View
      style={[
        styles.switcher,
        { backgroundColor: t.glassStrong, borderColor: t.glassBorder },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Previous month"
        onPress={() => setPeriod(shiftMonth(period.year, period.month, -1))}
        style={styles.switchButton}
        hitSlop={6}
      >
        <ChevronLeft size={20} color={t.text} />
      </Pressable>
      <Text style={[type.label, { color: t.text }]}>
        {monthLabel(period.year, period.month)}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Next month"
        accessibilityState={{ disabled: isCurrent }}
        disabled={isCurrent}
        onPress={() => setPeriod(shiftMonth(period.year, period.month, 1))}
        style={styles.switchButton}
        hitSlop={6}
      >
        <ChevronRight size={20} color={isCurrent ? t.textSubtle : t.text} />
      </Pressable>
    </View>
  );

  return (
    <Screen tabs title="Insights" subtitle="Where your money went">
      {monthSwitcher}

      <GlassCard style={styles.donutCard}>
        {categories.length === 0 ? (
          <Empty
            icon={ChartPie}
            title="No spending yet"
            message="Confirmed expenses for this month will be broken down here."
          />
        ) : (
          <>
            <Donut data={categories} total={current} />
            {change !== null ? (
              <View style={styles.trend}>
                <Chip
                  icon={change > 0 ? TrendingUp : TrendingDown}
                  tone={change > 0 ? 'warning' : 'success'}
                  label={`${Math.abs(change)}% ${
                    change > 0 ? 'more' : 'less'
                  } than ${monthLabel(previous.year, previous.month)}`}
                />
              </View>
            ) : (
              <Text
                style={[
                  type.caption,
                  styles.centerText,
                  { color: t.textMuted },
                ]}
              >
                No spending recorded in{' '}
                {monthLabel(previous.year, previous.month)} to compare.
              </Text>
            )}
          </>
        )}
      </GlassCard>

      {categories.length > 0 && (
        <>
          <SectionTitle>By category</SectionTitle>
          <GlassCard>
            {categories.map((c, index) => {
              const share =
                current > 0 ? Math.round((c.totalPaise / current) * 100) : 0;
              const { color } = categoryVisual(c.categoryId);
              return (
                <View key={c.categoryId}>
                  {index > 0 && <Divider />}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${c.name}, ${formatPaise(
                      c.totalPaise,
                    )}, ${share} percent. Show transactions`}
                    onPress={() =>
                      navigation.navigate('CategoryTransactions', {
                        categoryId: c.categoryId,
                        name: c.name,
                        year: period.year,
                        month: period.month,
                      })
                    }
                    style={({ pressed }) => [
                      styles.catRow,
                      pressed && { opacity: 0.6 },
                    ]}
                  >
                    <CategoryBadge id={c.categoryId} size={40} />
                    <View style={styles.flex}>
                      <View style={styles.catHeader}>
                        <Text
                          style={[type.label, { color: t.text }]}
                          numberOfLines={1}
                        >
                          {c.name}
                        </Text>
                        <Text
                          style={[type.label, styles.amount, { color: t.text }]}
                        >
                          {formatPaise(c.totalPaise)}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.track,
                          { backgroundColor: alpha(color, 0.14) },
                        ]}
                      >
                        <View
                          style={[
                            styles.bar,
                            {
                              backgroundColor: color,
                              width: `${(c.totalPaise / max) * 100}%`,
                            },
                          ]}
                        />
                      </View>
                      <Text style={[type.caption, { color: t.textSubtle }]}>
                        {share}% · {c.count}{' '}
                        {c.count === 1 ? 'payment' : 'payments'}
                      </Text>
                    </View>
                  </Pressable>
                </View>
              );
            })}
          </GlassCard>
        </>
      )}

      {(merchants.data ?? []).length > 0 && (
        <>
          <SectionTitle>Top merchants</SectionTitle>
          <GlassCard>
            {(merchants.data ?? []).map((m, index) => (
              <View key={`${m.name}-${index}`}>
                {index > 0 && <Divider />}
                <ListRow
                  leading={
                    <View
                      style={[
                        styles.rank,
                        {
                          backgroundColor:
                            index === 0 ? t.primary : alpha(t.primary, 0.12),
                        },
                      ]}
                    >
                      {index === 0 ? (
                        <Store size={18} color="#FFFFFF" />
                      ) : (
                        <Text style={[type.label, { color: t.primary }]}>
                          {index + 1}
                        </Text>
                      )}
                    </View>
                  }
                  title={m.name}
                  subtitle={`${m.count} ${
                    m.count === 1 ? 'payment' : 'payments'
                  }`}
                  right={
                    <Text
                      style={[type.label, styles.amount, { color: t.text }]}
                    >
                      {formatPaise(m.totalPaise)}
                    </Text>
                  }
                />
              </View>
            ))}
          </GlassCard>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 6 },
  switcher: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.pill,
    borderWidth: 1,
    padding: 4,
    marginBottom: spacing.md,
  },
  switchButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutCard: { alignItems: 'center', paddingVertical: spacing.xl },
  donutWrap: {
    width: DONUT,
    height: DONUT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutCenter: { position: 'absolute', alignItems: 'center' },
  trend: { marginTop: spacing.lg },
  centerText: { textAlign: 'center', marginTop: spacing.lg },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  catHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  amount: { fontVariant: ['tabular-nums'] },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  bar: { height: 8, borderRadius: 4 },
  rank: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
