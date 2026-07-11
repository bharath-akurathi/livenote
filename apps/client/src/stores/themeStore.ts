import { create } from 'zustand';
import { applyTheme, type Theme } from '../lib/theme';

interface ThemeStore {
  theme: Theme;
  /** Set an explicit theme. */
  setTheme: (theme: Theme) => void;
  /** Flip between light and dark. */
  toggle: () => void;
}

/**
 * Reads the current theme from the DOM. The inline script in index.html has
 * already applied the saved/resolved theme (and the `.dark` class) before
 * React mounts, so this avoids a flash of the wrong theme on hydration.
 */
function currentTheme(): Theme {
  if (
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('dark')
  ) {
    return 'dark';
  }
  return 'light';
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  theme: currentTheme(),
  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },
  toggle: () => {
    const next: Theme = get().theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    set({ theme: next });
  },
}));
