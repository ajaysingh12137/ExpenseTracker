import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Receipt } from 'lucide-react-native';
import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { listConfirmed } from '../db/repository';
import { formatDateTime, monthLabel, monthRange } from '../domain/dates';
import { formatPaise } from '../domain/money';
import type { RootStackParamList } from '../navigation/types';
import {
  AmountText,
  CategoryBadge,
  Empty,
  GlassCard,
  ListRow,
  Screen,
} from '../ui/components';
import { spacing, type, useTheme } from '../ui/theme';
import { useDbQuery } from '../ui/useDbQuery';

type Props = NativeStackScreenProps<RootStackParamList, 'CategoryTransactions'>;

export function CategoryTransactionsScreen({ route, navigation }: Props) {
  const { categoryId, name, year, month } = route.params;
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [from, to] = monthRange(year, month);
  const list = useDbQuery(
    () => listConfirmed({ from, to, categoryId }),
    [from, categoryId],
  );
  const total = (list.data ?? []).reduce(
    (sum, tx) => sum + (tx.direction === 'debit' ? tx.amountPaise : 0),
    0,
  );

  return (
    <Screen
      scroll={false}
      onBack={navigation.goBack}
      title={name}
      subtitle={monthLabel(year, month)}
    >
      <FlatList
        data={list.data ?? []}
        keyExtractor={item => String(item.id)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
        ListHeaderComponent={
          (list.data ?? []).length > 0 ? (
            <GlassCard strong style={styles.summary}>
              <CategoryBadge id={categoryId} size={52} />
              <View style={styles.flex}>
                <Text style={[type.caption, { color: t.textMuted }]}>
                  {(list.data ?? []).length} payments
                </Text>
                <Text style={[type.h2, { color: t.text }]}>
                  {formatPaise(total)}
                </Text>
              </View>
            </GlassCard>
          ) : undefined
        }
        ListEmptyComponent={
          list.loading ? undefined : (
            <Empty
              icon={Receipt}
              title="Nothing here"
              message="No confirmed expenses in this category for the month."
            />
          )
        }
        renderItem={({ item }) => (
          <GlassCard style={styles.item} padded={false}>
            <View style={styles.itemInner}>
              <ListRow
                title={item.merchantName ?? 'Unknown payee'}
                subtitle={`${formatDateTime(item.occurredAt)}${
                  item.note ? `  ·  ${item.note}` : ''
                }`}
                right={
                  <AmountText
                    paise={item.amountPaise}
                    direction={item.direction}
                  />
                }
                accessibilityLabel={`${
                  item.merchantName ?? 'Unknown'
                }, ${formatPaise(item.amountPaise)}. Edit`}
                onPress={() =>
                  navigation.navigate('EditTransaction', { id: item.id })
                }
                chevron
              />
            </View>
          </GlassCard>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  item: { marginBottom: spacing.sm },
  itemInner: { paddingHorizontal: spacing.md },
});
