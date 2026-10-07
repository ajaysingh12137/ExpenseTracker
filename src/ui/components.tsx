import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { StyleProp, TextInputProps, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatPaise } from '../domain/money';
import type { Category, Direction } from '../domain/types';
import { radius, spacing, useTheme } from './theme';

export function Screen({
  children,
  scroll = true,
  padded = true,
  safeTop = false,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  /** For screens shown without a navigation header. */
  safeTop?: boolean;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const style = [{ flex: 1, backgroundColor: t.bg }];
  const content = {
    padding: padded ? spacing.lg : 0,
    paddingTop: (safeTop ? insets.top : 0) + (padded ? spacing.lg : 0),
    paddingBottom: insets.bottom + spacing.xl,
  };
  if (!scroll) {
    return <View style={[style, content]}>{children}</View>;
  }
  return (
    <ScrollView
      style={style}
      contentContainerStyle={content}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: t.surface, borderColor: t.border },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Title({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <Text accessibilityRole="header" style={[styles.title, { color: t.text }]}>
      {children}
    </Text>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <Text
      accessibilityRole="header"
      style={[styles.section, { color: t.textMuted }]}
    >
      {children}
    </Text>
  );
}

export function Body({
  children,
  muted,
}: {
  children: React.ReactNode;
  muted?: boolean;
}) {
  const t = useTheme();
  return (
    <Text
      style={[
        styles.body,
        styles.paragraph,
        { color: muted ? t.textMuted : t.text },
      ]}
    >
      {children}
    </Text>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  busy,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  busy?: boolean;
  accessibilityHint?: string;
}) {
  const t = useTheme();
  const bg =
    variant === 'primary'
      ? t.primary
      : variant === 'danger'
      ? t.danger
      : t.surfaceAlt;
  const fg = variant === 'secondary' ? t.text : t.onPrimary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled || !!busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const t = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: t.textMuted }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={t.textMuted}
        {...props}
        style={[
          styles.input,
          { color: t.text, backgroundColor: t.surface, borderColor: t.border },
        ]}
      />
    </View>
  );
}

export function Amount({
  paise,
  direction,
  large,
}: {
  paise: number;
  direction: Direction;
  large?: boolean;
}) {
  const t = useTheme();
  const color = direction === 'credit' ? t.credit : t.text;
  return (
    <Text style={[large ? styles.amountLarge : styles.amount, { color }]}>
      {direction === 'credit' ? '+' : ''}
      {formatPaise(paise)}
    </Text>
  );
}

export function Pill({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'warning';
}) {
  const t = useTheme();
  const color = tone === 'warning' ? t.warning : t.textMuted;
  return (
    <View style={[styles.pill, { borderColor: color }]}>
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  const t = useTheme();
  return (
    <View
      style={[styles.segmented, { backgroundColor: t.surfaceAlt }]}
      accessibilityRole="radiogroup"
    >
      {options.map(option => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[styles.segment, selected && { backgroundColor: t.surface }]}
          >
            <Text
              style={[
                styles.segmentText,
                { color: selected ? t.text : t.textMuted },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function CategoryPicker({
  visible,
  categories,
  selectedId,
  onSelect,
  onClose,
}: {
  visible: boolean;
  categories: ReadonlyArray<Category>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const t = useTheme();
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityLabel="Close category list"
      />
      <View style={[styles.sheet, { backgroundColor: t.surface }]}>
        <Text style={[styles.section, { color: t.textMuted }]}>
          Choose a category
        </Text>
        <FlatList
          data={categories}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={item.name}
              accessibilityState={{ selected: item.id === selectedId }}
              onPress={() => onSelect(item.id)}
              style={[
                styles.sheetRow,
                item.id === selectedId && { backgroundColor: t.surfaceAlt },
              ]}
            >
              <Text style={styles.icon}>{item.icon}</Text>
              <Text style={[styles.body, { color: t.text }]}>{item.name}</Text>
            </Pressable>
          )}
        />
      </View>
    </Modal>
  );
}

export function Empty({ title, message }: { title: string; message: string }) {
  const t = useTheme();
  return (
    <View style={styles.empty}>
      <Text style={[styles.emptyTitle, { color: t.text }]}>{title}</Text>
      <Text style={[styles.body, styles.center, { color: t.textMuted }]}>
        {message}
      </Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  title: { fontSize: 24, fontWeight: '700', marginBottom: spacing.md },
  section: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  body: { fontSize: 16, lineHeight: 22 },
  paragraph: { marginBottom: spacing.sm },
  button: {
    minHeight: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  buttonText: { fontSize: 16, fontWeight: '600' },
  field: { marginBottom: spacing.md },
  fieldLabel: { fontSize: 13, marginBottom: spacing.xs },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    fontSize: 16,
  },
  amount: { fontSize: 17, fontWeight: '700' },
  amountLarge: { fontSize: 32, fontWeight: '700' },
  pill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  pillText: { fontSize: 12, fontWeight: '600' },
  segmented: {
    flexDirection: 'row',
    borderRadius: radius.md,
    padding: 3,
    marginBottom: spacing.md,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  segmentText: { fontSize: 15, fontWeight: '600' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    maxHeight: '70%',
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  icon: { fontSize: 20, width: 36 },
  empty: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: spacing.sm },
  center: { textAlign: 'center' },
});
