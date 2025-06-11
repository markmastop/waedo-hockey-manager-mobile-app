import React, { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';
import { DarkColors, LightColors, ThemeColors } from '@/theme/colors';

interface ThemeContextType {
  colors: ThemeColors;
  scheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextType>({
  colors: LightColors,
  scheme: 'light',
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = scheme === 'dark' ? DarkColors : LightColors;

  return (
    <ThemeContext.Provider value={{ colors, scheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
