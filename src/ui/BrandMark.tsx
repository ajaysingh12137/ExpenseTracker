import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, {
  ClipPath,
  Defs,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { type as typography, useTheme } from './theme';

/**
 * The brand mark: ₹ with a gold "auto" spark on the indigo→violet squircle. Same geometry as
 * the launcher icon (docs/brand/brand-mark.svg, 108-unit adaptive-icon grid).
 */
const RUPEE = [
  'M36 35 H66',
  'M36 46 H66',
  'M44 35 C56 35 61 40 61 45.5 C61 51.5 56 57 46 57 H40',
  'M40 57 L62 77',
];
const SPARK =
  'M76 25 C76.8 29.6 78.4 31.2 83 32 C78.4 32.8 76.8 34.4 76 39 C75.2 34.4 73.6 32.8 69 32 C73.6 31.2 75.2 29.6 76 25 Z';

export const BRAND_NAME = 'ExpenseTracker';
export const BRAND_TAGLINE = 'Expenses, logged for you';

export function BrandMark({ size = 96 }: { size?: number }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 108 108"
      accessibilityLabel={`${BRAND_NAME} logo`}
    >
      <Defs>
        <ClipPath id="bmClip">
          <Rect width={108} height={108} rx={30} ry={30} />
        </ClipPath>
        <LinearGradient id="bmBg" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#4F46E5" />
          <Stop offset="1" stopColor="#9333EA" />
        </LinearGradient>
        <RadialGradient id="bmHl" cx="0.25" cy="0.15" r="0.75">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.28} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <G clipPath="url(#bmClip)">
        <Rect width={108} height={108} fill="url(#bmBg)" />
        <Rect width={108} height={108} fill="url(#bmHl)" />
        <G
          transform="translate(-2 -2)"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={7.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {RUPEE.map(d => (
            <Path key={d} d={d} />
          ))}
        </G>
        <Path d={SPARK} fill="#FFD58A" />
      </G>
    </Svg>
  );
}

/** Size the native splash draws the mark at on Android 12+ (46% of the 288dp icon canvas). */
const NATIVE_SPLASH_MARK = 132;

/**
 * Cold-start intro. Its first frame matches the native splash exactly (same background, same
 * mark, same position), then the mark lifts, the wordmark fades in, and the whole layer fades
 * out over the app, which is already mounted underneath.
 */
export function BrandIntro({
  ready,
  onFirstFrame,
  onDone,
}: {
  /** True once the app underneath has what it needs to render. */
  ready: boolean;
  /** Called after the intro's first frame is on screen (release the native splash here). */
  onFirstFrame: () => void;
  onDone: () => void;
}) {
  const t = useTheme();
  const progress = useRef(new Animated.Value(0)).current; // mark lift + wordmark
  const fade = useRef(new Animated.Value(1)).current; // whole layer

  useEffect(() => {
    const id = requestAnimationFrame(onFirstFrame);
    return () => cancelAnimationFrame(id);
  }, [onFirstFrame]);

  useEffect(() => {
    if (!ready) {
      return;
    }
    Animated.sequence([
      Animated.timing(progress, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.delay(260),
      Animated.timing(fade, {
        toValue: 0,
        duration: 280,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => finished && onDone());
  }, [ready, progress, fade, onDone]);

  const scale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.78],
  });
  const lift = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -36],
  });
  const wordOpacity = progress.interpolate({
    inputRange: [0.3, 1],
    outputRange: [0, 1],
  });
  const wordShift = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [12, 0],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.intro, { backgroundColor: t.bg, opacity: fade }]}
    >
      <Animated.View style={{ transform: [{ translateY: lift }, { scale }] }}>
        <BrandMark size={NATIVE_SPLASH_MARK} />
      </Animated.View>
      <Animated.View
        style={[
          styles.word,
          { opacity: wordOpacity, transform: [{ translateY: wordShift }] },
        ]}
      >
        <Text style={[typography.title, { color: t.text }]}>{BRAND_NAME}</Text>
        <Text style={[typography.body, { color: t.textMuted }]}>
          {BRAND_TAGLINE}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  intro: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  word: {
    position: 'absolute',
    top: '56%',
    alignItems: 'center',
    gap: 4,
  },
});

export function BrandLockup({ size = 56 }: { size?: number }) {
  const t = useTheme();
  return (
    <View style={lockup.row}>
      <BrandMark size={size} />
      <View>
        <Text style={[typography.h2, { color: t.text }]}>{BRAND_NAME}</Text>
        <Text style={[typography.caption, { color: t.textMuted }]}>
          {BRAND_TAGLINE}
        </Text>
      </View>
    </View>
  );
}

const lockup = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
