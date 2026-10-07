import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  Check,
  Mic,
  StickyNote,
  Store,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { keywordCategory, normalizeMerchant } from '../categories/categorize';
import { addManualTransaction, getCategories } from '../db/repository';
import { parseDayInput, toDayInput } from '../domain/dates';
import { parseRupeesToPaise } from '../domain/money';
import type { Direction } from '../domain/types';
import { startVoiceInput } from '../device/deviceServices';
import type { RootStackParamList } from '../navigation/types';
import { parseVoiceText } from '../parser/voiceParser';
import {
  AmountInput,
  Button,
  CategoryBadge,
  CategoryPicker,
  Field,
  GlassCard,
  IconBadge,
  Screen,
  Segmented,
  SelectRow,
} from '../ui/components';
import { alpha, radius, spacing, type, useTheme } from '../ui/theme';
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
        categoryId,
        occurredAt,
        note: note.trim() || null,
      });
      navigation.goBack();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      onBack={navigation.goBack}
      title="Add expense"
      subtitle="Cash or anything missed"
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Speak the expense"
        onPress={listen}
        style={({ pressed }) => [
          styles.voice,
          {
            backgroundColor: alpha('#14B8A6', t.dark ? 0.16 : 0.1),
            borderColor: alpha('#14B8A6', 0.3),
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <IconBadge icon={Mic} color="#14B8A6" solid size={44} />
        <View style={styles.flex}>
          <Text style={[type.label, { color: t.text }]}>Speak it</Text>
          <Text
            style={[type.caption, { color: t.textMuted }]}
            numberOfLines={2}
          >
            {heard
              ? `Heard: “${heard}”`
              : '“Spent 250 on lunch at Cafe Coffee”'}
          </Text>
        </View>
      </Pressable>

      <Segmented
        options={[
          { value: 'debit', label: 'Spent', icon: ArrowUpRight },
          { value: 'credit', label: 'Received', icon: ArrowDownLeft },
        ]}
        value={direction}
        onChange={setDirection}
      />

      <GlassCard>
        <AmountInput
          value={amount}
          onChangeText={setAmount}
          direction={direction}
          autoFocus={route.params?.voice !== true}
        />
      </GlassCard>

      <GlassCard>
        <Field
          label={direction === 'credit' ? 'From' : 'Paid to'}
          icon={Store}
          value={merchant}
          onChangeText={setMerchant}
          placeholder="e.g. Vegetable vendor"
        />
        <SelectRow
          label={categoryId ? 'Category' : 'Category (suggested)'}
          value={category?.name ?? 'Uncategorized'}
          leading={<CategoryBadge id={effectiveCategory} size={30} />}
          onPress={() => setPicker(true)}
        />
        <Field
          label="Date (DD-MM-YYYY)"
          icon={CalendarDays}
          value={day}
          onChangeText={setDay}
          keyboardType="numbers-and-punctuation"
        />
        <Field
          label="Note"
          icon={StickyNote}
          value={note}
          onChangeText={setNote}
          placeholder="Optional"
        />
      </GlassCard>

      <Button label="Save expense" icon={Check} onPress={save} busy={busy} />
      <Text style={[type.caption, styles.footnote, { color: t.textSubtle }]}>
        Voice uses your phone's speech service, which may process audio online.
      </Text>

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
  flex: { flex: 1 },
  voice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  footnote: { textAlign: 'center', marginTop: spacing.md },
});
