import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  hideValues: boolean;
  toggleHideValues: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'system',
  resolvedTheme: 'dark',
  setTheme: () => {},
  hideValues: false,
  toggleHideValues: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    return (localStorage.getItem('hub:theme') as Theme) || 'system';
  });

  const [hideValues, setHideValues] = useState<boolean>(() => {
    return localStorage.getItem('hub:hideValues') === 'true';
  });

  const [systemDark, setSystemDark] = useState<boolean>(() => {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const resolvedTheme: 'light' | 'dark' = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', resolvedTheme);
    if (resolvedTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [resolvedTheme]);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem('hub:theme', t);
  };

  const toggleHideValues = () => {
    setHideValues((prev) => {
      const next = !prev;
      localStorage.setItem('hub:hideValues', String(next));
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, hideValues, toggleHideValues }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
