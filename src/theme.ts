import { useMemo } from 'react';
import { useColorScheme } from 'react-native';

// Cream and one accent green in light mode, with matching dark colors.
const light = {
  bg: '#F7F4EC',
  surface: '#FFFFFF',
  fg: '#2B2F2A',
  muted: '#7A8077',
  tabInactive: '#4F554D',
  placeholder: '#BFC3BA',
  accent: '#5E9C7A',
  accentSoft: '#7FB89A',
  onAccent: '#FFFFFF',
  line: '#E7E2D6',
  grid: '#EEEAE0',
  error: '#B5523B',
  // Goal line: a calm dark gray, so it does not read as a warning.
  goal: '#4F554D',
};

const dark: Palette = {
  bg: '#1A1C19',
  surface: '#252823',
  fg: '#ECEAE3',
  muted: '#A3A99F',
  tabInactive: '#C4C9BF',
  placeholder: '#5E635B',
  accent: '#6FB08C',
  accentSoft: '#4D7D63',
  onAccent: '#FFFFFF',
  line: '#353932',
  grid: '#30332E',
  error: '#E58A72',
  goal: '#C4C9BF',
};

export type Palette = typeof light;

// Colors for the phone's current light or dark setting.
export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}

// Builds a component's styles from the current colors, rebuilt only when the mode changes.
export function useStyles<T>(make: (p: Palette) => T): T {
  const p = usePalette();
  return useMemo(() => make(p), [p, make]);
}
