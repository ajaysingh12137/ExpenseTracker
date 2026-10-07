import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { listConfirmed } from '../db/repository';
import { formatDateTime, monthRange } from '../domain/dates';
import { formatPaise } from '../domain/money';
import type { RootStackParamList } from '../navigation/types';
import { Amount, Empty } from '../ui/components';
import { spacing, useTheme } from '../ui/theme';
import { useDbQuery } from '../ui/useDbQuery';

type Props = NativeStackScreenProps<RootStackParamList, 'CategoryTransactions'>;

export function CategoryTransactionsScreen({ route, navigation }: Props) {
  const { categoryId, year, month } = route.params;
  const t = useTheme();
  const [from, to] = monthRange(year, month);
  const list = useDbQuery(
    () => listConfirmed({ from, to, categoryId }),
    [from, categoryId],
  );

  return (
    <FlatList
      style={{ backgroundColor: t.bg }}
      contentContainerStyle={styles.list}
      data={list.data ?? []}
      keyExtractor={item => String(item.id)}
      ListEmptyComponent={
        list.loading ? undefined : (
          <Empty
            title="Nothing here"
            message="No confirmed expenses in this category."
          />
        )
      }
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${item.merchantName ?? 'Unknown'}, ${formatPaise(
            item.amountPaise,
          )}. Edit`}
          onPress={() =>
            navigation.navigate('EditTransaction', { id: item.id })
          }
          style={[styles.row, { borderBottomColor: t.border }]}
        >
          <View style={styles.flex}>
            <Text style={[styles.name, { color: t.text }]} numberOfLines={1}>
              {item.merchantName ?? 'Unknown'}
            </Text>
            <Text style={[styles.meta, { color: t.textMuted }]}>
              {formatDateTime(item.occurredAt)}
              {item.note ? ` · ${item.note}` : ''}
            </Text>
          </View>
          <Amount paise={item.amountPaise} direction={item.direction} />
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 60,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  flex: { flex: 1, marginRight: spacing.sm },
  name: { fontSize: 16, fontWeight: '600' },
  meta: { fontSize: 13 },
});
