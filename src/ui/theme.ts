import { useColorScheme } from 'react-native';

/**
 * Design tokens. "Glass" = translucent surfaces with a bright hairline border over a soft
 * gradient backdrop (see AppBackground). Real blur is not used: Android blur needs an extra
 * native library and is costly in long lists; translucency over the gradient gives the look.
 */
export type Theme = {
  dark: boolean;
  bg: string;
  /** Backdrop gradient blobs: [colour, opacity]. */
  blobs: ReadonlyArray<readonly [string, number]>;
  glass: string;
  glassStrong: string;
  glassBorder: string;
  /** Brighter top edge of glass surfaces (light catching the rim). */
  glassRim: string;
  hairline: string;
  heroFrom: string;
  heroTo: string;
  /** Near-opaque surface for things that float over content (tab bar, swipe rows). */
  elevated: string;
  /** Opaque surface for bottom sheets. */
  sheet: string;
  /** High-contrast surface for snackbars, and the text on it. */
  inverse: string;
  onInverse: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  primary: string;
  primary2: string;
  onPrimary: string;
  debit: string;
  credit: string;
  warning: string;
  danger: string;
  shadow: string;
};

const light: Theme = {
  dark: false,
  bg: '#ECEEFF',
  blobs: [
    ['#7C5CFF', 0.62],
    ['#22D3EE', 0.5],
    ['#FF6FB5', 0.45],
    ['#FFB067', 0.4],
  ],
  glass: 'rgba(255,255,255,0.38)',
  glassStrong: 'rgba(255,255,255,0.62)',
  glassBorder: 'rgba(255,255,255,0.55)',
  glassRim: 'rgba(255,255,255,0.95)',
  hairline: 'rgba(17,20,45,0.08)',
  elevated: 'rgba(255,255,255,0.78)',
  sheet: '#FFFFFF',
  inverse: '#141726',
  onInverse: '#FFFFFF',
  text: '#0F1222',
  textMuted: '#555B70',
  textSubtle: '#7E8499',
  primary: '#5B4CF5',
  primary2: '#8E5CF6',
  heroFrom: '#4F46E5',
  heroTo: '#A855F7',
  onPrimary: '#FFFFFF',
  debit: '#D92D45',
  credit: '#13894A',
  warning: '#B45309',
  danger: '#D92D45',
  shadow: '#2A2E66',
};

const dark: Theme = {
  dark: true,
  bg: '#070814',
  blobs: [
    ['#6D5DFC', 0.55],
    ['#06B6D4', 0.34],
    ['#EC4899', 0.32],
    ['#F59E0B', 0.18],
  ],
  glass: 'rgba(255,255,255,0.07)',
  glassStrong: 'rgba(255,255,255,0.12)',
  glassBorder: 'rgba(255,255,255,0.10)',
  glassRim: 'rgba(255,255,255,0.28)',
  hairline: 'rgba(255,255,255,0.08)',
  elevated: 'rgba(22,24,42,0.86)',
  sheet: '#141726',
  inverse: '#EEF0FA',
  onInverse: '#141726',
  text: '#EEF0FA',
  textMuted: '#A7ACC2',
  textSubtle: '#7D839C',
  primary: '#7C6CFF',
  primary2: '#A78BFA',
  heroFrom: '#5B4CF5',
  heroTo: '#C026D3',
  onPrimary: '#FFFFFF',
  debit: '#FF7A85',
  credit: '#4ADE80',
  warning: '#FBBF24',
  danger: '#FF7A85',
  shadow: '#000000',
};

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 10, md: 16, lg: 22, xl: 28, pill: 999 };

export const type = {
  display: { fontSize: 34, fontWeight: '800' as const, letterSpacing: -0.8 },
  title: { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.5 },
  h2: { fontSize: 20, fontWeight: '700' as const, letterSpacing: -0.2 },
  h3: { fontSize: 17, fontWeight: '700' as const },
  body: { fontSize: 16, lineHeight: 23 },
  label: { fontSize: 15, fontWeight: '600' as const },
  caption: { fontSize: 13, lineHeight: 18 },
  overline: {
    fontSize: 12,
    fontWeight: '700' as const,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  },
};

/** Hex colour + alpha (0..1) -> #RRGGBBAA, for tinted icon backgrounds. */
export function alpha(hex: string, a: number): string {
  const value = Math.round(Math.min(1, Math.max(0, a)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex.slice(0, 7)}${value}`;
}
