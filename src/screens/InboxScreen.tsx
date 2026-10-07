import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  CopyCheck,
  Hand,
  Inbox,
  Sparkles,
  TriangleAlert,
  Undo2,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { listDrafts, setStatus } from '../db/repository';
import { formatDateTime } from '../domain/dates';
import { formatPaise } from '../domain/money';
import type { Transaction } from '../domain/types';
import type { RootStackParamList } from '../navigation/types';
import {
  AmountText,
  CategoryBadge,
  Chip,
  Empty,
  Screen,
  TAB_BAR_SPACE,
} from '../ui/components';
import { SwipeRow } from '../ui/SwipeRow';
import { alpha, radius, spacing, type, useTheme } from '../ui/theme';
import { useDbQuery } from '../ui/useDbQuery';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type UndoState = { id: number; message: string } | null;

export function InboxScreen() {
  const navigation = useNavigation<Nav>();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const drafts = useDbQuery(listDrafts, []);
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

  const count = drafts.data?.length ?? 0;

  return (
    <Screen
      scroll={false}
      title="Inbox"
      subtitle={count > 0 ? `${count} to review` : 'Nothing pending'}
    >
      <FlatList
        data={drafts.data ?? []}
        keyExtractor={item => String(item.id)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + TAB_BAR_SPACE }}
        ListHeaderComponent={
          count > 0 ? (
            <View
              style={[
                styles.hint,
                { backgroundColor: alpha(t.primary, t.dark ? 0.16 : 0.08) },
              ]}
            >
              <Hand size={16} color={t.primary} />
              <Text style={[type.caption, styles.flex, { color: t.textMuted }]}>
                Swipe right to confirm, left to ignore. Tap to edit.
              </Text>
            </View>
          ) : undefined
        }
        ListEmptyComponent={
          drafts.loading ? undefined : (
            <Empty
              icon={Inbox}
              title="All caught up"
              message="New payments from your bank and UPI apps will land here for a quick check."
            />
          )
        }
        renderItem={({ item }) => {
          const needsDetails = item.amountPaise <= 0;
          const name = item.merchantName ?? 'Unknown payee';
          return (
            <SwipeRow
              label={`${name}, ${
                needsDetails ? 'amount missing' : formatPaise(item.amountPaise)
              }`}
              confirmLabel={needsDetails ? 'Add details' : 'Confirm'}
              confirmIsEdit={needsDetails}
              onConfirm={() => confirm(item)}
              onIgnore={() => ignore(item)}
              onOpen={() =>
                navigation.navigate('EditTransaction', { id: item.id })
              }
            >
              <View style={styles.row}>
                <CategoryBadge id={item.categoryId} size={46} />
                <View style={styles.flex}>
                  <Text
                    style={[type.label, { color: t.text }]}
                    numberOfLines={1}
                  >
                    {name}
                  </Text>
                  <Text
                    style={[type.caption, { color: t.textMuted }]}
                    numberOfLines={1}
                  >
                    {formatDateTime(item.occurredAt)}
                    {item.accountHint ? `  ·  ••${item.accountHint}` : ''}
                  </Text>
                  {(needsDetails ||
                    item.possibleDuplicateOf !== null ||
                    item.parsedBy === 'ai') && (
                    <View style={styles.chips}>
                      {needsDetails && (
                        <Chip
                          label="Needs details"
                          icon={TriangleAlert}
                          tone="warning"
                        />
                      )}
                      {item.possibleDuplicateOf !== null && (
                        <Chip
                          label="Possible duplicate"
                          icon={CopyCheck}
                          tone="warning"
                        />
                      )}
                      {item.parsedBy === 'ai' && (
                        <Chip
                          label="Read by AI"
                          icon={Sparkles}
                          tone="primary"
                        />
                      )}
                    </View>
                  )}
                </View>
                {needsDetails ? (
                  <Text style={[type.h3, { color: t.warning }]}>₹ —</Text>
                ) : (
                  <AmountText
                    paise={item.amountPaise}
                    direction={item.direction}
                  />
                )}
              </View>
            </SwipeRow>
          );
        }}
      />
      {undo && (
        <View
          style={[
            styles.snack,
            {
              bottom: insets.bottom + TAB_BAR_SPACE - spacing.sm,
              backgroundColor: t.inverse,
            },
          ]}
          accessibilityLiveRegion="polite"
        >
          <Text style={[type.label, styles.flex, { color: t.onInverse }]}>
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
            <Undo2 size={18} color={t.primary2} strokeWidth={2.5} />
            <Text style={[type.label, { color: t.primary2 }]}>Undo</Text>
          </Pressable>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  chips: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  snack: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    borderRadius: radius.md,
    paddingLeft: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
  },
  snackButton: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.lg,
  },
});
