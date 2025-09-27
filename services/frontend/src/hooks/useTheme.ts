import { useEffect } from 'react';

export type Theme = 'light' | 'dark' | 'system';

export const useTheme = (theme: Theme) => {
  useEffect(() => {
    const applyTheme = (selectedTheme: Theme) => {
      const root = document.documentElement;
      
      // Remove existing theme classes
      root.classList.remove('light', 'dark');
      
      if (selectedTheme === 'system') {
        // Use system preference
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        root.classList.add(systemTheme);
      } else {
        // Use selected theme
        root.classList.add(selectedTheme);
      }
    };

    applyTheme(theme);

    // Listen for system theme changes when using 'system' theme
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme('system');
      
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme]);
};