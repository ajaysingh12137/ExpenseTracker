import { useColorScheme } from 'react-native';

export type Theme = {
  dark: boolean;
  bg: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textMuted: string;
  border: string;
  primary: string;
  onPrimary: string;
  debit: string;
  credit: string;
  warning: string;
  danger: string;
};

const light: Theme = {
  dark: false,
  bg: '#F6F7F9',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF1F5',
  text: '#14181F',
  textMuted: '#5B6573',
  border: '#DCE1E8',
  primary: '#1F6FEB',
  onPrimary: '#FFFFFF',
  debit: '#B42318',
  credit: '#067647',
  warning: '#B54708',
  danger: '#B42318',
};

const dark: Theme = {
  dark: true,
  bg: '#0E1116',
  surface: '#171B22',
  surfaceAlt: '#212733',
  text: '#E8ECF2',
  textMuted: '#9AA4B2',
  border: '#2C3442',
  primary: '#4C8DFF',
  onPrimary: '#0B1220',
  debit: '#FF8A80',
  credit: '#6CE9A6',
  warning: '#FDB022',
  danger: '#FF8A80',
};

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
export const radius = { sm: 8, md: 12, lg: 16 };
