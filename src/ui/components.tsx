import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import React, { useCallback, useId, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import type {
  LayoutChangeEvent,
  StyleProp,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { formatPaise } from '../domain/money';
import type { Category, Direction } from '../domain/types';
import { categoryVisual } from './categoryVisuals';
import { alpha, radius, spacing, type, useTheme } from './theme';

/** Space reserved under tab screens for the floating tab bar. */
export const TAB_BAR_SPACE = 104;

const useSvgId = (prefix: string) =>
  `${prefix}${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

// ---------------------------------------------------------------------------------------------
// Backdrop + gradients
//
// react-native-svg does not size reliably from percentages on Android (gradients rendered at a
// stale size), so every SVG here is drawn at measured pixel sizes.

type Size = { w: number; h: number };

/** Measures the parent box; children render only once the size is known. */
function useBoxSize(): [Size | null, (e: LayoutChangeEvent) => void] {
  const [size, setSize] = useState<Size | null>(null);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize(prev =>
      prev && prev.w === width && prev.h === height
        ? prev
        : { w: width, h: height },
    );
  }, []);
  return [size, onLayout];
}

/**
 * Vivid colour field behind every screen. Glass only reads as glass when there is colour
 * behind it, so these glows are deliberately strong.
 */
export function AppBackground() {
  const t = useTheme();
  const id = useSvgId('bg');
  const { width: w, height: h } = useWindowDimensions();
  const spots = [
    { cx: -0.1 * w, cy: 0.02 * h, r: 0.85 * w },
    { cx: 1.1 * w, cy: 0.3 * h, r: 0.8 * w },
    { cx: 0.05 * w, cy: 0.72 * h, r: 0.85 * w },
    { cx: 1.0 * w, cy: 1.0 * h, r: 0.7 * w },
  ];
  return (
    <View
      style={[StyleSheet.absoluteFill, { backgroundColor: t.bg }]}
      pointerEvents="none"
    >
      <Svg width={w} height={h}>
        <Defs>
          {t.blobs.map(([color, opacity], i) => (
            <RadialGradient key={i} id={`${id}${i}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={color} stopOpacity={opacity} />
              <Stop
                offset="0.55"
                stopColor={color}
                stopOpacity={opacity * 0.45}
              />
              <Stop offset="1" stopColor={color} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>
        {spots.map((spot, i) => (
          <Circle
            key={i}
            cx={spot.cx}
            cy={spot.cy}
            r={spot.r}
            fill={`url(#${id}${i % t.blobs.length})`}
          />
        ))}
      </Svg>
    </View>
  );
}

/** Brand gradient filling its parent (parent sets size and radius). */
export function GradientFill({
  from,
  to,
  rounded = 0,
}: {
  from?: string;
  to?: string;
  rounded?: number;
}) {
  const t = useTheme();
  const id = useSvgId('lg');
  const [size, onLayout] = useBoxSize();
  const first = from ?? t.primary;
  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        { borderRadius: rounded, backgroundColor: first },
      ]}
      onLayout={onLayout}
      pointerEvents="none"
    >
      {size ? (
        <Svg width={size.w} height={size.h}>
          <Defs>
            <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={first} />
              <Stop offset="1" stopColor={to ?? t.primary2} />
            </LinearGradient>
          </Defs>
          <Rect
            x={0}
            y={0}
            width={size.w}
            height={size.h}
            rx={rounded}
            ry={rounded}
            fill={`url(#${id})`}
          />
        </Svg>
      ) : null}
    </View>
  );
}

/**
 * Specular highlight for glass: a white wash from the top-left fading out. Together with the
 * bright top rim and the colour behind, this is what turns a translucent box into "glass".
 */
export function GlassSheen({
  rounded,
  strength = 1,
}: {
  rounded: number;
  strength?: number;
}) {
  const t = useTheme();
  const id = useSvgId('sh');
  const [size, onLayout] = useBoxSize();
  const top = (t.dark ? 0.14 : 0.7) * strength;
  return (
    <View
      style={StyleSheet.absoluteFill}
      onLayout={onLayout}
      pointerEvents="none"
    >
      {size ? (
        <Svg width={size.w} height={size.h}>
          <Defs>
            <LinearGradient id={id} x1="0" y1="0" x2="0.6" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={top} />
              <Stop
                offset="0.45"
                stopColor="#FFFFFF"
                stopOpacity={top * 0.25}
              />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect
            x={0}
            y={0}
            width={size.w}
            height={size.h}
            rx={rounded}
            ry={rounded}
            fill={`url(#${id})`}
          />
        </Svg>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// Screen scaffolding

export function Screen({
  children,
  title,
  subtitle,
  onBack,
  right,
  scroll = true,
  tabs = false,
  padded = true,
}: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  scroll?: boolean;
  /** Tab screens leave room for the floating tab bar. */
  tabs?: boolean;
  padded?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const bottom = insets.bottom + (tabs ? TAB_BAR_SPACE : spacing.xl);
  const header =
    title || onBack || right ? (
      <ScreenHeader
        title={title}
        subtitle={subtitle}
        onBack={onBack}
        right={right}
      />
    ) : null;
  const pad = padded ? spacing.lg : 0;

  return (
    <View style={styles.flex}>
      <AppBackground />
      <View style={[styles.flex, { paddingTop: insets.top }]}>
        {scroll ? (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={{
              paddingHorizontal: pad,
              paddingBottom: bottom,
            }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {header}
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.flex, { paddingHorizontal: pad }]}>
            {header}
            {children}
          </View>
        )}
      </View>
    </View>
  );
}

export function ScreenHeader({
  title,
  subtitle,
  onBack,
  right,
}: {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
}) {
  const t = useTheme();
  return (
    <View style={styles.header}>
      {onBack ? (
        <IconButton icon={ChevronLeft} label="Back" onPress={onBack} />
      ) : null}
      <View style={[styles.flex, onBack ? styles.headerTextWithBack : null]}>
        {subtitle ? (
          <Text style={[type.caption, { color: t.textMuted }]}>{subtitle}</Text>
        ) : null}
        {title ? (
          <Text
            accessibilityRole="header"
            style={[onBack ? type.h2 : type.title, { color: t.text }]}
            numberOfLines={1}
          >
            {title}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// Surfaces

export function GlassCard({
  children,
  style,
  strong,
  padded = true,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  strong?: boolean;
  padded?: boolean;
}) {
  const t = useTheme();
  return (
    <View
      style={[
        styles.glass,
        {
          backgroundColor: strong ? t.glassStrong : t.glass,
          borderColor: t.glassBorder,
          borderTopColor: t.glassRim,
        },
        style,
      ]}
    >
      <GlassSheen rounded={radius.lg} strength={strong ? 0.8 : 1} />
      <View style={padded ? styles.glassPad : undefined}>{children}</View>
    </View>
  );
}

/** Kept for existing call sites: a glass card. */
export const Card = GlassCard;

export function HeroCard({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View
      style={[
        styles.hero,
        {
          // Opaque base so the shadow renders as a shadow (not a pale box) on Android.
          backgroundColor: t.heroFrom,
          boxShadow: `0 14px 30px ${alpha(t.heroFrom, 0.38)}`,
        },
      ]}
    >
      <GradientFill rounded={radius.xl} from={t.heroFrom} to={t.heroTo} />
      <View style={styles.heroOrbA} pointerEvents="none" />
      <View style={styles.heroOrbB} pointerEvents="none" />
      <GlassSheen rounded={radius.xl} strength={0.35} />
      <View style={styles.heroContent}>{children}</View>
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// Text

export function Title({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <Text
      accessibilityRole="header"
      style={[type.title, styles.titleGap, { color: t.text }]}
    >
      {children}
    </Text>
  );
}

export function SectionTitle({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: { label: string; onPress: () => void };
}) {
  const t = useTheme();
  return (
    <View style={styles.sectionRow}>
      <Text
        accessibilityRole="header"
        style={[type.overline, { color: t.textSubtle }]}
      >
        {children}
      </Text>
      {action ? (
        <Pressable
          accessibilityRole="button"
          onPress={action.onPress}
          hitSlop={12}
          style={styles.sectionAction}
        >
          <Text style={[type.caption, styles.bold, { color: t.primary }]}>
            {action.label}
          </Text>
          <ChevronRight size={14} color={t.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function Body({
  children,
  muted,
  center,
}: {
  children: React.ReactNode;
  muted?: boolean;
  center?: boolean;
}) {
  const t = useTheme();
  return (
    <Text
      style={[
        type.body,
        styles.paragraph,
        center && styles.center,
        { color: muted ? t.textMuted : t.text },
      ]}
    >
      {children}
    </Text>
  );
}

export function AmountText({
  paise,
  direction,
  size = 'md',
  color,
}: {
  paise: number;
  direction: Direction;
  size?: 'md' | 'lg' | 'xl';
  color?: string;
}) {
  const t = useTheme();
  const fontSize = size === 'xl' ? 38 : size === 'lg' ? 24 : 16;
  return (
    <Text
      style={{
        fontSize,
        fontWeight: '800',
        letterSpacing: size === 'md' ? 0 : -0.8,
        color: color ?? (direction === 'credit' ? t.credit : t.text),
        fontVariant: ['tabular-nums'],
      }}
    >
      {direction === 'credit' ? '+' : ''}
      {formatPaise(paise)}
    </Text>
  );
}

/** Kept for existing call sites. */
export const Amount = ({
  paise,
  direction,
  large,
}: {
  paise: number;
  direction: Direction;
  large?: boolean;
}) => (
  <AmountText paise={paise} direction={direction} size={large ? 'lg' : 'md'} />
);

// ---------------------------------------------------------------------------------------------
// Icons

export function IconBadge({
  icon: Icon,
  color,
  size = 44,
  solid,
}: {
  icon: LucideIcon;
  color: string;
  size?: number;
  solid?: boolean;
}) {
  return (
    <View
      style={[
        styles.badge,
        {
          width: size,
          height: size,
          borderRadius: size * 0.34,
          backgroundColor: solid ? color : alpha(color, 0.16),
        },
      ]}
    >
      <Icon
        size={size * 0.48}
        color={solid ? '#FFFFFF' : color}
        strokeWidth={2.2}
      />
    </View>
  );
}

export function CategoryBadge({
  id,
  size = 44,
}: {
  id: string;
  size?: number;
}) {
  const { Icon, color } = categoryVisual(id);
  return <IconBadge icon={Icon} color={color} size={size} />;
}

export function IconButton({
  icon: Icon,
  label,
  onPress,
  tone = 'glass',
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  tone?: 'glass' | 'primary';
}) {
  const t = useTheme();
  const primary = tone === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.iconButton,
        {
          backgroundColor: primary ? t.primary : t.glassStrong,
          borderColor: primary ? t.primary : t.glassBorder,
          transform: [{ scale: pressed ? 0.94 : 1 }],
        },
      ]}
    >
      <Icon
        size={20}
        color={primary ? t.onPrimary : t.text}
        strokeWidth={2.2}
      />
    </Pressable>
  );
}

// ---------------------------------------------------------------------------------------------
// Buttons and controls

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon: Icon,
  disabled,
  busy,
  accessibilityHint,
  compact,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: LucideIcon;
  disabled?: boolean;
  busy?: boolean;
  accessibilityHint?: string;
  compact?: boolean;
}) {
  const t = useTheme();
  const isPrimary = variant === 'primary';
  const fg = isPrimary
    ? t.onPrimary
    : variant === 'danger'
    ? t.danger
    : variant === 'ghost'
    ? t.primary
    : t.text;
  const inactive = !!disabled || !!busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: !!busy }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        isPrimary
          ? {
              boxShadow: disabled
                ? undefined
                : `0 8px 20px ${alpha(t.primary, 0.32)}`,
            }
          : variant === 'ghost'
          ? null
          : {
              backgroundColor:
                variant === 'danger' ? alpha(t.danger, 0.1) : t.glassStrong,
              borderColor:
                variant === 'danger' ? alpha(t.danger, 0.25) : t.glassBorder,
              borderWidth: 1,
            },
        {
          opacity: disabled ? 0.45 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
    >
      {isPrimary ? <GradientFill rounded={radius.md} /> : null}
      {busy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.buttonInner}>
          {Icon ? <Icon size={19} color={fg} strokeWidth={2.3} /> : null}
          <Text style={[type.label, { color: fg }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  icon: Icon,
  prefix,
  ...props
}: TextInputProps & { label: string; icon?: LucideIcon; prefix?: string }) {
  const t = useTheme();
  const [focused, setFocused] = React.useState(false);
  return (
    <View style={styles.field}>
      <Text style={[type.caption, styles.fieldLabel, { color: t.textMuted }]}>
        {label}
      </Text>
      <View
        style={[
          styles.inputWrap,
          {
            backgroundColor: t.glassStrong,
            borderColor: focused ? t.primary : t.glassBorder,
          },
        ]}
      >
        {Icon ? (
          <Icon size={18} color={focused ? t.primary : t.textSubtle} />
        ) : null}
        {prefix ? (
          <Text style={[styles.prefix, { color: t.textMuted }]}>{prefix}</Text>
        ) : null}
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={t.textSubtle}
          {...props}
          onFocus={e => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={e => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          style={[
            styles.input,
            { color: t.text },
            props.multiline && styles.inputMultiline,
          ]}
        />
      </View>
    </View>
  );
}

/** Big centred amount entry used on add/edit screens. */
export function AmountInput({
  value,
  onChangeText,
  direction,
  autoFocus,
}: {
  value: string;
  onChangeText: (value: string) => void;
  direction: Direction;
  autoFocus?: boolean;
}) {
  const t = useTheme();
  return (
    <View style={styles.amountInputWrap}>
      <Text style={[type.caption, { color: t.textMuted }]}>
        {direction === 'credit' ? 'Amount received' : 'Amount spent'}
      </Text>
      <View style={styles.amountInputRow}>
        <Text style={[styles.amountRupee, { color: t.textSubtle }]}>₹</Text>
        <TextInput
          accessibilityLabel="Amount in rupees"
          value={value}
          onChangeText={onChangeText}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={t.textSubtle}
          autoFocus={autoFocus}
          style={[
            styles.amountInput,
            { color: direction === 'credit' ? t.credit : t.text },
          ]}
        />
      </View>
    </View>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: ReadonlyArray<{ value: T; label: string; icon?: LucideIcon }>;
  value: T;
  onChange: (value: T) => void;
}) {
  const t = useTheme();
  return (
    <View
      style={[
        styles.segmented,
        { backgroundColor: t.glass, borderColor: t.glassBorder },
      ]}
      accessibilityRole="radiogroup"
    >
      {options.map(option => {
        const selected = option.value === value;
        const Icon = option.icon;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[
              styles.segment,
              selected && {
                backgroundColor: t.glassStrong,
                boxShadow: `0 2px 8px ${alpha(t.shadow, t.dark ? 0.4 : 0.1)}`,
              },
            ]}
          >
            {Icon ? (
              <Icon
                size={16}
                color={selected ? t.primary : t.textMuted}
                strokeWidth={2.4}
              />
            ) : null}
            <Text
              style={[type.label, { color: selected ? t.text : t.textMuted }]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({
  label,
  icon: Icon,
  tone = 'neutral',
}: {
  label: string;
  icon?: LucideIcon;
  tone?: 'neutral' | 'warning' | 'primary' | 'success';
}) {
  const t = useTheme();
  const color =
    tone === 'warning'
      ? t.warning
      : tone === 'primary'
      ? t.primary
      : tone === 'success'
      ? t.credit
      : t.textMuted;
  return (
    <View style={[styles.chip, { backgroundColor: alpha(color, 0.12) }]}>
      {Icon ? <Icon size={12} color={color} strokeWidth={2.6} /> : null}
      <Text style={[styles.chipText, { color }]}>{label}</Text>
    </View>
  );
}

/** Kept for existing call sites. */
export const Pill = ({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'warning';
}) => <Chip label={label} tone={tone} />;

export function ListRow({
  icon,
  iconColor,
  leading,
  title,
  subtitle,
  right,
  onPress,
  accessibilityLabel,
  chevron,
}: {
  icon?: LucideIcon;
  iconColor?: string;
  leading?: React.ReactNode;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  chevron?: boolean;
}) {
  const t = useTheme();
  const content = (
    <>
      {leading ??
        (icon ? (
          <IconBadge icon={icon} color={iconColor ?? t.primary} size={40} />
        ) : null)}
      <View style={styles.rowText}>
        <Text style={[type.label, { color: t.text }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[type.caption, { color: t.textMuted }]}
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
      {chevron ? <ChevronRight size={18} color={t.textSubtle} /> : null}
    </>
  );
  if (!onPress) {
    return <View style={styles.listRow}>{content}</View>;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      onPress={onPress}
      style={({ pressed }) => [styles.listRow, pressed && { opacity: 0.6 }]}
    >
      {content}
    </Pressable>
  );
}

export function ToggleRow({
  icon,
  iconColor,
  title,
  subtitle,
  value,
  onChange,
  disabled,
}: {
  icon: LucideIcon;
  iconColor?: string;
  title: string;
  subtitle?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const t = useTheme();
  return (
    <ListRow
      icon={icon}
      iconColor={iconColor}
      title={title}
      subtitle={subtitle}
      right={
        <Switch
          accessibilityLabel={title}
          value={value}
          onValueChange={onChange}
          disabled={disabled}
          thumbColor="#FFFFFF"
          trackColor={{ true: t.primary, false: alpha(t.textSubtle, 0.4) }}
        />
      }
    />
  );
}

export function Divider() {
  const t = useTheme();
  return <View style={[styles.divider, { backgroundColor: t.hairline }]} />;
}

export function SelectRow({
  label,
  value,
  leading,
  onPress,
}: {
  label: string;
  value: string;
  leading?: React.ReactNode;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[type.caption, styles.fieldLabel, { color: t.textMuted }]}>
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value}. Change`}
        onPress={onPress}
        style={[
          styles.inputWrap,
          { backgroundColor: t.glassStrong, borderColor: t.glassBorder },
        ]}
      >
        {leading}
        <Text style={[type.body, styles.flex, { color: t.text }]}>{value}</Text>
        <ChevronRight size={18} color={t.textSubtle} />
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// Sheets and states

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
  const insets = useSafeAreaInsets();
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
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: t.sheet,
            paddingBottom: insets.bottom + spacing.lg,
          },
        ]}
      >
        <View style={[styles.grabber, { backgroundColor: t.hairline }]} />
        <Text style={[type.h3, styles.sheetTitle, { color: t.text }]}>
          Choose a category
        </Text>
        <FlatList
          data={categories}
          numColumns={3}
          keyExtractor={item => item.id}
          columnWrapperStyle={styles.gridRow}
          renderItem={({ item }) => {
            const selected = item.id === selectedId;
            const { color } = categoryVisual(item.id);
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={item.name}
                accessibilityState={{ selected }}
                onPress={() => onSelect(item.id)}
                style={[
                  styles.gridTile,
                  {
                    borderColor: selected ? color : t.hairline,
                    backgroundColor: selected
                      ? alpha(color, 0.1)
                      : 'transparent',
                  },
                ]}
              >
                <CategoryBadge id={item.id} size={42} />
                <Text
                  style={[type.caption, styles.tileLabel, { color: t.text }]}
                  numberOfLines={2}
                >
                  {item.name}
                </Text>
              </Pressable>
            );
          }}
        />
      </View>
    </Modal>
  );
}

export function Empty({
  title,
  message,
  icon,
}: {
  title: string;
  message: string;
  icon?: LucideIcon;
}) {
  const t = useTheme();
  return (
    <View style={styles.empty}>
      {icon ? <IconBadge icon={icon} color={t.primary} size={72} /> : null}
      <Text style={[type.h2, styles.emptyTitle, { color: t.text }]}>
        {title}
      </Text>
      <Text style={[type.body, styles.center, { color: t.textMuted }]}>
        {message}
      </Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  bold: { fontWeight: '700' },
  paragraph: { marginBottom: spacing.sm },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  headerTextWithBack: { marginLeft: spacing.xs },
  titleGap: { marginBottom: spacing.md },
  glass: {
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  glassPad: { padding: spacing.lg },
  hero: {
    borderRadius: radius.xl,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  heroContent: { padding: spacing.xl },
  heroOrbA: {
    position: 'absolute',
    top: -70,
    right: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  heroOrbB: {
    position: 'absolute',
    bottom: -90,
    left: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  badge: { alignItems: 'center', justifyContent: 'center' },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    minHeight: 54,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  buttonCompact: { minHeight: 44 },
  buttonInner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  field: { marginBottom: spacing.md },
  fieldLabel: { marginBottom: 6, marginLeft: spacing.xs, fontWeight: '600' },
  inputWrap: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  input: { flex: 1, fontSize: 16, paddingVertical: spacing.md },
  inputMultiline: { minHeight: 120, textAlignVertical: 'top' },
  prefix: { fontSize: 16, fontWeight: '600' },
  amountInputWrap: { alignItems: 'center', paddingVertical: spacing.lg },
  amountInputRow: { flexDirection: 'row', alignItems: 'center' },
  amountRupee: { fontSize: 34, fontWeight: '700', marginRight: 4 },
  amountInput: {
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: -1,
    minWidth: 80,
    textAlign: 'center',
    paddingVertical: 0,
  },
  segmented: {
    flexDirection: 'row',
    borderRadius: radius.md,
    borderWidth: 1,
    padding: 4,
    marginBottom: spacing.md,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm + 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  chipText: { fontSize: 11, fontWeight: '700' },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 60,
    paddingVertical: spacing.sm,
  },
  rowText: { flex: 1, gap: 2 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: spacing.xs },
  backdrop: { flex: 1, backgroundColor: 'rgba(5,6,15,0.45)' },
  sheet: {
    maxHeight: '75%',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
  },
  grabber: {
    width: 40,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: spacing.sm,
  },
  sheetTitle: { marginVertical: spacing.lg },
  gridRow: { gap: spacing.sm, marginBottom: spacing.sm },
  gridTile: {
    flex: 1,
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    gap: spacing.sm,
  },
  tileLabel: { textAlign: 'center', fontWeight: '600' },
  empty: {
    alignItems: 'center',
    paddingVertical: 56,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  emptyTitle: { marginTop: spacing.md },
});
