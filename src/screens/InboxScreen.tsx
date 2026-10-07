import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { getCategories, listDrafts, setStatus } from '../db/repository';
import { formatDateTime } from '../domain/dates';
import { formatPaise } from '../domain/money';
import type { Transaction } from '../domain/types';
import type { RootStackParamList } from '../navigation/types';
import { Amount, Empty, Pill } from '../ui/components';
import { SwipeRow } from '../ui/SwipeRow';
import { spacing, useTheme } from '../ui/theme';
import { useDbQuery } from '../ui/useDbQuery';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type UndoState = { id: number; message: string } | null;

export function InboxScreen() {
  const navigation = useNavigation<Nav>();
  const t = useTheme();
  const drafts = useDbQuery(listDrafts, []);
  const categories = useDbQuery(getCategories, []);
  const [undo, setUndo] = useState<UndoState>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    },
    [],
  );

  const showUndo = useCallback((state: UndoState) => {
    if (timer.current) {
      clearTimeout(timer.current);
    }
    setUndo(state);
    timer.current = setTimeout(() => setUndo(null), 5000);
  }, []);

  const confirm = useCallback(
    async (tx: Transaction) => {
      if (tx.amountPaise <= 0) {
        // Missing amount: the user has to fill it in first.
        navigation.navigate('EditTransaction', { id: tx.id });
        return;
      }
      await setStatus(tx.id, 'confirmed');
      showUndo({
        id: tx.id,
        message: `Confirmed ${formatPaise(tx.amountPaise)}`,
      });
    },
    [navigation, showUndo],
  );

  const ignore = useCallback(
    async (tx: Transaction) => {
      await setStatus(tx.id, 'ignored');
      showUndo({ id: tx.id, message: 'Ignored' });
    },
    [showUndo],
  );

  const categoryOf = (id: string) => categories.data?.find(c => c.id === id);

  return (
    <View style={[styles.root, { backgroundColor: t.bg }]}>
      <FlatList
        data={drafts.data ?? []}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          drafts.data && drafts.data.length > 0 ? (
            <Text style={[styles.hint, { color: t.textMuted }]}>
              Swipe right to confirm, left to ignore. Tap to edit.
            </Text>
          ) : undefined
        }
        ListEmptyComponent={
          drafts.loading ? undefined : (
            <Empty
              title="All caught up"
              message="New payments from your bank and UPI apps will appear here for a quick check."
            />
          )
        }
        renderItem={({ item }) => {
          const category = categoryOf(item.categoryId);
          const needsDetails = item.amountPaise <= 0;
          const name = item.merchantName ?? 'Unknown payee';
          return (
            <SwipeRow
              label={`${name}, ${
                needsDetails ? 'amount missing' : formatPaise(item.amountPaise)
              }, ${category?.name ?? ''}`}
              confirmLabel={needsDetails ? 'Add details' : 'Confirm'}
              onConfirm={() => confirm(item)}
              onIgnore={() => ignore(item)}
              onOpen={() =>
                navigation.navigate('EditTransaction', { id: item.id })
              }
            >
              <View style={styles.row}>
                <Text style={styles.icon}>{category?.icon ?? '❓'}</Text>
                <View style={styles.flex}>
                  <Text
                    style={[styles.name, { color: t.text }]}
                    numberOfLines={1}
                  >
                    {name}
                  </Text>
                  <Text style={[styles.meta, { color: t.textMuted }]}>
                    {category?.name ?? 'Uncategorized'} ·{' '}
                    {formatDateTime(item.occurredAt)}
                    {item.accountHint ? ` · ••${item.accountHint}` : ''}
                  </Text>
                  <View style={styles.pills}>
                    {needsDetails && (
                      <Pill label="Needs details" tone="warning" />
                    )}
                    {item.possibleDuplicateOf !== null && (
                      <Pill label="Possible duplicate" tone="warning" />
                    )}
                    {item.parsedBy === 'ai' && <Pill label="Read by AI" />}
                  </View>
                </View>
                {needsDetails ? (
                  <Text style={[styles.name, { color: t.warning }]}>₹ ?</Text>
                ) : (
                  <Amount paise={item.amountPaise} direction={item.direction} />
                )}
              </View>
            </SwipeRow>
          );
        }}
      />
      {undo && (
        <View
          style={[styles.snack, { backgroundColor: t.text }]}
          accessibilityLiveRegion="polite"
        >
          <Text style={[styles.snackText, { color: t.bg }]}>
            {undo.message}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Undo"
            onPress={async () => {
              await setStatus(undo.id, 'draft');
              setUndo(null);
            }}
            style={styles.snackButton}
          >
            <Text style={[styles.snackAction, { color: t.primary }]}>UNDO</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  list: { padding: spacing.lg, paddingBottom: 96 },
  hint: { fontSize: 13, marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center' },
  icon: { fontSize: 24, width: 40 },
  flex: { flex: 1, marginRight: spacing.sm },
  name: { fontSize: 16, fontWeight: '600' },
  meta: { fontSize: 13, marginTop: 2 },
  pills: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
    flexWrap: 'wrap',
  },
  snack: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
    borderRadius: 10,
    paddingLeft: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  snackText: { flex: 1, fontSize: 15 },
  snackButton: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  snackAction: { fontWeight: '700' },
});
