import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';
import {
  getCategories,
  getRawText,
  getTransaction,
  setStatus,
  updateTransaction,
} from '../db/repository';
import { formatDateTime, parseDayInput, toDayInput } from '../domain/dates';
import { formatPaise, parseRupeesToPaise } from '../domain/money';
import type { Direction, Transaction } from '../domain/types';
import type { RootStackParamList } from '../navigation/types';
import {
  Body,
  Button,
  Card,
  CategoryPicker,
  Field,
  Pill,
  Screen,
  SectionTitle,
  Segmented,
} from '../ui/components';
import { spacing, useTheme } from '../ui/theme';
import { useDbQuery } from '../ui/useDbQuery';

type Props = NativeStackScreenProps<RootStackParamList, 'EditTransaction'>;

export function EditTransactionScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const t = useTheme();
  const categories = useDbQuery(getCategories, []);
  const [tx, setTx] = useState<Transaction | null>(null);
  const [raw, setRaw] = useState<{ title: string; body: string } | null>(null);
  const [duplicate, setDuplicate] = useState<Transaction | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  const [amount, setAmount] = useState('');
  const [direction, setDirection] = useState<Direction>('debit');
  const [merchant, setMerchant] = useState('');
  const [categoryId, setCategoryId] = useState('uncategorized');
  const [day, setDay] = useState('');
  const [note, setNote] = useState('');
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const loaded = await getTransaction(id);
      if (!loaded) {
        navigation.goBack();
        return;
      }
      setTx(loaded);
      setAmount(
        loaded.amountPaise > 0
          ? (loaded.amountPaise / 100).toFixed(2).replace(/\.00$/, '')
          : '',
      );
      setDirection(loaded.direction);
      setMerchant(loaded.merchantName ?? '');
      setCategoryId(loaded.categoryId);
      setDay(toDayInput(loaded.occurredAt));
      setNote(loaded.note ?? '');
      if (loaded.rawCaptureId !== null) {
        setRaw(await getRawText(loaded.rawCaptureId));
      }
      if (loaded.possibleDuplicateOf !== null) {
        setDuplicate(await getTransaction(loaded.possibleDuplicateOf));
      }
    })();
  }, [id, navigation]);

  if (!tx) {
    return <Screen>{null}</Screen>;
  }

  const category = categories.data?.find(c => c.id === categoryId);

  const save = async (confirm: boolean) => {
    const amountPaise = parseRupeesToPaise(amount);
    if (amountPaise === null || amountPaise <= 0) {
      Alert.alert(
        'Check the amount',
        'Enter the amount in rupees, for example 250 or 99.50.',
      );
      return;
    }
    const occurredAt = parseDayInput(day, tx.occurredAt);
    if (occurredAt === null) {
      Alert.alert(
        'Check the date',
        'Use the format DD-MM-YYYY, for example 07-10-2026.',
      );
      return;
    }
    setBusy(true);
    try {
      await updateTransaction(
        id,
        {
          amountPaise,
          direction,
          merchant: merchant.trim() || null,
          categoryId,
          occurredAt,
          note: note.trim() || null,
        },
        { confirm },
      );
      navigation.goBack();
    } finally {
      setBusy(false);
    }
  };

  const ignore = async () => {
    await setStatus(id, 'ignored');
    navigation.goBack();
  };

  return (
    <Screen>
      {duplicate && (
        <Card>
          <Pill label="Possible duplicate" tone="warning" />
          <Body>
            Looks like {formatPaise(duplicate.amountPaise)} to{' '}
            {duplicate.merchantName ?? 'the same payee'} at{' '}
            {formatDateTime(duplicate.occurredAt)}. If you paid twice, keep
            both. If it is the same payment, ignore this one.
          </Body>
        </Card>
      )}
      <Segmented
        options={[
          { value: 'debit', label: 'Spent' },
          { value: 'credit', label: 'Received' },
        ]}
        value={direction}
        onChange={setDirection}
      />
      <Field
        label="Amount (₹)"
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder="0"
      />
      <Field
        label={direction === 'credit' ? 'From' : 'Paid to'}
        value={merchant}
        onChangeText={setMerchant}
      />
      <Text style={[styles.label, { color: t.textMuted }]}>Category</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Category: ${
          category?.name ?? 'Uncategorized'
        }. Change`}
        onPress={() => setPicker(true)}
        style={[
          styles.select,
          { borderColor: t.border, backgroundColor: t.surface },
        ]}
      >
        <Text style={[styles.selectText, { color: t.text }]}>
          {category?.icon} {category?.name ?? 'Uncategorized'}
        </Text>
      </Pressable>
      <Field
        label="Date (DD-MM-YYYY)"
        value={day}
        onChangeText={setDay}
        keyboardType="numbers-and-punctuation"
      />
      <Field
        label="Note"
        value={note}
        onChangeText={setNote}
        placeholder="Optional"
      />
      {merchant.trim() !== '' && (
        <Body muted>
          Changing the category also updates future payments to this payee.
        </Body>
      )}

      {tx.status === 'draft' ? (
        <>
          <Button label="Confirm" onPress={() => save(true)} busy={busy} />
          <Button
            label="Save, keep in inbox"
            variant="secondary"
            onPress={() => save(false)}
            disabled={busy}
          />
          <Button
            label="Ignore (not an expense)"
            variant="secondary"
            onPress={ignore}
            disabled={busy}
          />
        </>
      ) : (
        <>
          <Button label="Save" onPress={() => save(false)} busy={busy} />
          <Button
            label="Delete"
            variant="danger"
            onPress={ignore}
            disabled={busy}
          />
        </>
      )}

      {raw && (
        <>
          <SectionTitle>Original notification</SectionTitle>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: showRaw }}
            onPress={() => setShowRaw(v => !v)}
          >
            <Card>
              {showRaw ? (
                <>
                  <Body>{raw.title}</Body>
                  <Body muted>{raw.body}</Body>
                </>
              ) : (
                <Body muted>Tap to show the text this was read from.</Body>
              )}
            </Card>
          </Pressable>
        </>
      )}

      <CategoryPicker
        visible={picker}
        categories={categories.data ?? []}
        selectedId={categoryId}
        onSelect={value => {
          setCategoryId(value);
          setPicker(false);
        }}
        onClose={() => setPicker(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, marginBottom: spacing.xs },
  select: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 8,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  selectText: { fontSize: 16 },
});
