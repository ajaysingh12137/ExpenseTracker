import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';
import { keywordCategory, normalizeMerchant } from '../categories/categorize';
import { addManualTransaction, getCategories } from '../db/repository';
import { parseDayInput, toDayInput } from '../domain/dates';
import { parseRupeesToPaise } from '../domain/money';
import type { Direction } from '../domain/types';
import { startVoiceInput } from '../device/deviceServices';
import type { RootStackParamList } from '../navigation/types';
import { parseVoiceText } from '../parser/voiceParser';
import {
  Body,
  Button,
  CategoryPicker,
  Field,
  Screen,
  Segmented,
} from '../ui/components';
import { spacing, useTheme } from '../ui/theme';
import { useDbQuery } from '../ui/useDbQuery';

type Props = NativeStackScreenProps<RootStackParamList, 'AddTransaction'>;

export function AddTransactionScreen({ route, navigation }: Props) {
  const t = useTheme();
  const categories = useDbQuery(getCategories, []);
  const [amount, setAmount] = useState('');
  const [direction, setDirection] = useState<Direction>('debit');
  const [merchant, setMerchant] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [day, setDay] = useState(toDayInput(Date.now()));
  const [note, setNote] = useState('');
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [heard, setHeard] = useState<string | null>(null);
  const autoVoice = useRef(route.params?.voice === true);

  const listen = useCallback(async () => {
    const result = await startVoiceInput(
      'Say something like "spent 250 on lunch at Cafe Coffee"',
    );
    if (result.kind === 'unavailable') {
      Alert.alert(
        'Voice entry unavailable',
        'This phone has no speech recognition service. Type the expense instead.',
      );
      return;
    }
    if (result.kind === 'cancelled') {
      return;
    }
    setHeard(result.text);
    const draft = parseVoiceText(result.text);
    if (draft.amountPaise !== null) {
      setAmount(String(draft.amountPaise / 100));
    }
    setDirection(draft.direction);
    if (draft.merchant) {
      setMerchant(draft.merchant);
    }
    setNote(result.text);
  }, []);

  useEffect(() => {
    if (autoVoice.current) {
      autoVoice.current = false;
      listen();
    }
  }, [listen]);

  // Suggest a category from the payee name until the user picks one.
  const suggested = merchant.trim()
    ? keywordCategory(normalizeMerchant(merchant))
    : null;
  const effectiveCategory =
    categoryId ??
    suggested ??
    (direction === 'credit' ? 'income' : 'uncategorized');
  const category = categories.data?.find(c => c.id === effectiveCategory);

  const save = async () => {
    const amountPaise = parseRupeesToPaise(amount);
    if (amountPaise === null || amountPaise <= 0) {
      Alert.alert(
        'Check the amount',
        'Enter the amount in rupees, for example 250 or 99.50.',
      );
      return;
    }
    const occurredAt = parseDayInput(day, Date.now());
    if (occurredAt === null) {
      Alert.alert(
        'Check the date',
        'Use the format DD-MM-YYYY, for example 07-10-2026.',
      );
      return;
    }
    setBusy(true);
    try {
      await addManualTransaction({
        amountPaise,
        direction,
        merchant: merchant.trim() || null,
        categoryId: categoryId,
        occurredAt,
        note: note.trim() || null,
      });
      navigation.goBack();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Button label="🎤 Speak it" variant="secondary" onPress={listen} />
      {heard && <Body muted>Heard: “{heard}”. Check the fields below.</Body>}
      <Body muted>
        Voice uses your phone's speech service, which may process audio online.
      </Body>
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
        autoFocus={route.params?.voice !== true}
      />
      <Field
        label={direction === 'credit' ? 'From' : 'Paid to'}
        value={merchant}
        onChangeText={setMerchant}
        placeholder="e.g. Vegetable vendor"
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
      <Button label="Save" onPress={save} busy={busy} />
      <CategoryPicker
        visible={picker}
        categories={categories.data ?? []}
        selectedId={effectiveCategory}
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
