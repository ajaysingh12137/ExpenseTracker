import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { categoryTotals, sumDebits, topMerchants } from '../db/repository';
import { monthLabel, monthRange, shiftMonth } from '../domain/dates';
import { formatPaise } from '../domain/money';
import type { RootStackParamList } from '../navigation/types';
import { Body, Card, Screen, SectionTitle } from '../ui/components';
import { radius, spacing, useTheme } from '../ui/theme';
import { useDbQuery } from '../ui/useDbQuery';

type Nav = NativeStackNavigationProp<RootStackParamList>;

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
  const max = Math.max(1, ...(byCategory.data ?? []).map(c => c.totalPaise));

  return (
    <Screen>
      <View style={styles.monthBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          onPress={() => setPeriod(shiftMonth(period.year, period.month, -1))}
          style={styles.navButton}
        >
          <Text style={[styles.navText, { color: t.primary }]}>‹</Text>
        </Pressable>
        <Text
          accessibilityRole="header"
          style={[styles.month, { color: t.text }]}
        >
          {monthLabel(period.year, period.month)}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next month"
          accessibilityState={{ disabled: isCurrent }}
          disabled={isCurrent}
          onPress={() => setPeriod(shiftMonth(period.year, period.month, 1))}
          style={styles.navButton}
        >
          <Text
            style={[
              styles.navText,
              { color: isCurrent ? t.border : t.primary },
            ]}
          >
            ›
          </Text>
        </Pressable>
      </View>

      <Card>
        <Text style={[styles.label, { color: t.textMuted }]}>Total spent</Text>
        <Text style={[styles.total, { color: t.text }]}>
          {formatPaise(current)}
        </Text>
        <Text style={[styles.label, { color: t.textMuted }]}>
          {change === null
            ? 'No spending recorded last month to compare.'
            : `${change > 0 ? '▲' : change < 0 ? '▼' : '•'} ${Math.abs(
                change,
              )}% vs ${monthLabel(
                previous.year,
                previous.month,
              )} (${formatPaise(last)})`}
        </Text>
      </Card>

      <SectionTitle>By category</SectionTitle>
      {(byCategory.data ?? []).length === 0 ? (
        <Body muted>No confirmed expenses this month.</Body>
      ) : (
        (byCategory.data ?? []).map(c => {
          const share =
            current > 0 ? Math.round((c.totalPaise / current) * 100) : 0;
          return (
            <Pressable
              key={c.categoryId}
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
              style={styles.catRow}
            >
              <View style={styles.catHeader}>
                <Text style={[styles.catName, { color: t.text }]}>
                  {c.icon} {c.name}
                </Text>
                <Text style={[styles.catAmount, { color: t.text }]}>
                  {formatPaise(c.totalPaise)}
                </Text>
              </View>
              <View style={[styles.track, { backgroundColor: t.surfaceAlt }]}>
                <View
                  style={[
                    styles.bar,
                    {
                      backgroundColor: t.primary,
                      width: `${(c.totalPaise / max) * 100}%`,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.meta, { color: t.textMuted }]}>
                {share}% · {c.count} {c.count === 1 ? 'payment' : 'payments'}
              </Text>
            </Pressable>
          );
        })
      )}

      <SectionTitle>Top merchants</SectionTitle>
      {(merchants.data ?? []).length === 0 ? (
        <Body muted>Nothing yet.</Body>
      ) : (
        <Card>
          {(merchants.data ?? []).map((m, index) => (
            <View key={`${m.name}-${index}`} style={styles.merchantRow}>
              <Text
                style={[styles.catName, styles.flex, { color: t.text }]}
                numberOfLines={1}
              >
                {index + 1}. {m.name}
              </Text>
              <Text style={[styles.catAmount, { color: t.text }]}>
                {formatPaise(m.totalPaise)}
              </Text>
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  navButton: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navText: { fontSize: 28, fontWeight: '600' },
  month: { fontSize: 18, fontWeight: '700' },
  label: { fontSize: 13 },
  total: { fontSize: 30, fontWeight: '700', marginVertical: spacing.xs },
  catRow: { marginBottom: spacing.md, paddingVertical: spacing.xs },
  catHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  catName: { fontSize: 15, fontWeight: '600' },
  catAmount: { fontSize: 15, fontWeight: '700' },
  track: { height: 10, borderRadius: radius.sm, overflow: 'hidden' },
  bar: { height: 10, borderRadius: radius.sm },
  meta: { fontSize: 12, marginTop: 2 },
  merchantRow: { flexDirection: 'row', alignItems: 'center', minHeight: 40 },
  flex: { flex: 1, marginRight: spacing.sm },
});
