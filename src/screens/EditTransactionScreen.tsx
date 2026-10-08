import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Ban,
  CalendarDays,
  Check,
  ChevronDown,
  CopyCheck,
  Save,
  Sparkles,
  StickyNote,
  Store,
  Trash,
  Split,
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  getCategories,
  getTransaction,
  setStatus,
  updateTransaction,
  listSources,
  splitSource,
} from '../db/repository';
import { sourceIcon, sourceLabel } from '../capture/sourceLabels';
import { processCaptures } from '../pipeline/processCaptures';
import { formatDateTime, parseDayInput, toDayInput } from '../domain/dates';
import { formatPaise, parseRupeesToPaise } from '../domain/money';
import type { Direction, Transaction } from '../domain/types';
import type { RootStackParamList } from '../navigation/types';
import {
  AmountInput,
  Body,
  Button,
  CategoryBadge,
  CategoryPicker,
  Divider,
  Chip,
  Field,
  GlassCard,
  IconBadge,
  Screen,
  SectionTitle,
  Segmented,
  SelectRow,
} from '../ui/components';
import { spacing, type, useTheme } from '../ui/theme';
import { useDbQuery } from '../ui/useDbQuery';

type Props = NativeStackScreenProps<RootStackParamList, 'EditTransaction'>;

export function EditTransactionScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const t = useTheme();
  const categories = useDbQuery(getCategories, []);
  const [tx, setTx] = useState<Transaction | null>(null);
  const sources = useDbQuery(() => listSources(id), [id]);
  const [duplicate, setDuplicate] = useState<Transaction | null>(null);
  const [openSource, setOpenSource] = useState<number | null>(null);

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
      if (loaded.possibleDuplicateOf !== null) {
        setDuplicate(await getTransaction(loaded.possibleDuplicateOf));
      }
    })();
  }, [id, navigation]);

  if (!tx) {
    return <Screen onBack={navigation.goBack}>{null}</Screen>;
  }

  const isDraft = tx.status === 'draft';
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

  /** Destructive: always confirm, naming what will go. */
  const confirmRemove = () => {
    const what = `${formatPaise(tx.amountPaise)}${
      tx.merchantName ? ` to ${tx.merchantName}` : ''
    }`;
    const draft = tx.status === 'draft';
    Alert.alert(
      draft ? 'Not an expense?' : 'Delete this expense?',
      draft
        ? `${what} will be removed from your Inbox and won't count in your totals.`
        : `${what} will be removed from your totals and history.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: draft ? 'Remove' : 'Delete',
          style: 'destructive',
          onPress: () => {
            ignore().catch(() => {});
          },
        },
      ],
    );
  };

  return (
    <Screen
      onBack={navigation.goBack}
      title={isDraft ? 'Review payment' : 'Edit expense'}
      subtitle={formatDateTime(tx.occurredAt)}
    >
      {duplicate && (
        <GlassCard strong>
          <View style={styles.rowTop}>
            <IconBadge icon={CopyCheck} color={t.warning} size={40} />
            <View style={styles.flex}>
              <Text style={[type.label, { color: t.text }]}>
                Possible duplicate
              </Text>
              <Text style={[type.caption, { color: t.textMuted }]}>
                {formatPaise(duplicate.amountPaise)} to{' '}
                {duplicate.merchantName ?? 'the same payee'} at{' '}
                {formatDateTime(duplicate.occurredAt)}. Paid twice? Keep both.
                Same payment? Ignore this one.
              </Text>
            </View>
          </View>
        </GlassCard>
      )}

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
        />
      </GlassCard>

      <GlassCard>
        <Field
          label={direction === 'credit' ? 'From' : 'Paid to'}
          icon={Store}
          value={merchant}
          onChangeText={setMerchant}
          placeholder="Payee name"
        />
        <SelectRow
          label="Category"
          value={category?.name ?? 'Uncategorized'}
          leading={<CategoryBadge id={categoryId} size={30} />}
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
        {merchant.trim() !== '' && (
          <Chip
            icon={Sparkles}
            tone="primary"
            label="Category changes apply to future payments to this payee"
          />
        )}
      </GlassCard>

      {isDraft ? (
        <>
          <Button
            label="Confirm expense"
            icon={Check}
            onPress={() => save(true)}
            busy={busy}
          />
          <View style={styles.buttonRow}>
            <View style={styles.flex}>
              <Button
                label="Save draft"
                icon={Save}
                variant="secondary"
                onPress={() => save(false)}
                disabled={busy}
              />
            </View>
            <View style={styles.flex}>
              <Button
                label="Not an expense"
                icon={Ban}
                variant="danger"
                onPress={confirmRemove}
                disabled={busy}
              />
            </View>
          </View>
        </>
      ) : (
        <>
          <Button
            label="Save changes"
            icon={Save}
            onPress={() => save(false)}
            busy={busy}
          />
          <Button
            label="Delete expense"
            icon={Trash}
            variant="danger"
            onPress={confirmRemove}
            disabled={busy}
          />
        </>
      )}

      {(sources.data ?? []).length > 0 && (
        <>
          <SectionTitle>
            {(sources.data ?? []).length > 1
              ? `Reported by ${(sources.data ?? []).length} apps`
              : 'Source'}
          </SectionTitle>
          <GlassCard>
            {(sources.data ?? []).map((source, index) => {
              const open = openSource === source.rawCaptureId;
              return (
                <View key={source.rawCaptureId}>
                  {index > 0 && <Divider />}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded: open }}
                    accessibilityLabel={`${sourceLabel(
                      source.packageName,
                    )} notification`}
                    onPress={() =>
                      setOpenSource(open ? null : source.rawCaptureId)
                    }
                    style={styles.rowCenter}
                  >
                    <IconBadge
                      icon={sourceIcon(source.packageName)}
                      color={t.primary}
                      size={36}
                    />
                    <View style={styles.flex}>
                      <Text style={[type.label, { color: t.text }]}>
                        {sourceLabel(source.packageName)}
                      </Text>
                      <Text style={[type.caption, { color: t.textMuted }]}>
                        {formatDateTime(source.postedAt)}
                      </Text>
                    </View>
                    <View style={open ? styles.rotated : undefined}>
                      <ChevronDown size={18} color={t.textSubtle} />
                    </View>
                  </Pressable>
                  {open && (
                    <View style={styles.rawBody}>
                      <Body>{source.title}</Body>
                      <Body muted>{source.body}</Body>
                      {!source.primary && (
                        <Button
                          label="Separate payment? Split"
                          icon={Split}
                          variant="secondary"
                          compact
                          onPress={() =>
                            Alert.alert(
                              'Split into its own payment?',
                              `Use this if the ${sourceLabel(
                                source.packageName,
                              )} alert was a different payment. It becomes a separate entry in the Inbox.`,
                              [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                  text: 'Split',
                                  onPress: async () => {
                                    await splitSource(source.rawCaptureId);
                                    processCaptures().catch(() => {});
                                  },
                                },
                              ],
                            )
                          }
                        />
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </GlassCard>
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
  flex: { flex: 1 },
  rowTop: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  rowCenter: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  buttonRow: { flexDirection: 'row', gap: spacing.sm },
  rawBody: { marginTop: spacing.md },
  rotated: { transform: [{ rotate: '180deg' }] },
});
