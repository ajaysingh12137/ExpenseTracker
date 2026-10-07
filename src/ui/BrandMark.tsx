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
 * The Notch mark: four tally strokes crossed by a gold fifth ("every rupee, noted") on a
 * midnight-to-indigo squircle. Same geometry as the launcher icon (scripts/brand/design.js).
 */
const STROKES = ['M36 32 V76', 'M48 32 V76', 'M60 32 V76', 'M72 32 V76'];
const SLASH = 'M28 70 L80 38';

export const BRAND_NAME = 'Notch';
export const BRAND_TAGLINE = 'Every rupee, noted.';

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
          <Stop offset="0" stopColor="#1E1B4B" />
          <Stop offset="1" stopColor="#4F46E5" />
        </LinearGradient>
        <RadialGradient id="bmHl" cx="0.25" cy="0.15" r="0.75">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.22} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <G clipPath="url(#bmClip)">
        <Rect width={108} height={108} fill="url(#bmBg)" />
        <Rect width={108} height={108} fill="url(#bmHl)" />
        <G fill="none" stroke="#FFFFFF" strokeWidth={6.5} strokeLinecap="round">
          {STROKES.map(d => (
            <Path key={d} d={d} />
          ))}
        </G>
        <Path
          d={SLASH}
          fill="none"
          stroke="#FFD58A"
          strokeWidth={7.5}
          strokeLinecap="round"
        />
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
