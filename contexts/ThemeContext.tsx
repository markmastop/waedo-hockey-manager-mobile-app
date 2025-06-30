/** Theme provider exposing light and dark colors. */
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

/**
 * Provides color tokens based on the current device color scheme.
 * Components can consume these values for consistent theming.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = scheme === 'dark' ? DarkColors : LightColors;

  return (
    <ThemeContext.Provider value={{ colors, scheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Hook to access the ThemeContext values like colors and scheme.
 * Simplifies reading theme information inside components.
 */
export function useTheme() {
  return useContext(ThemeContext);
}
