/**
 * Theme handling — single source of truth for light/dark mode.
 *
 * The actual class swap happens on <html> (`.dark`) so that the CSS custom
 * properties defined in index.css flip for the whole document. The chosen
 * theme is persisted in a cookie (not localStorage) so it survives page
 * reloads, browser sessions, and is available before React mounts.
 */

export type Theme = 'light' | 'dark';

const THEME_COOKIE = 'theme';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function readCookie(): Theme | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)theme=([^;]+)/);
  const value = match?.[1];
  return value === 'light' || value === 'dark' ? value : null;
}

function getSystemTheme(): Theme {
  if (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  ) {
    return 'dark';
  }
  return 'light';
}

/** Apply a theme to the document and persist it in a cookie. */
export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
}

/**
 * Resolve the theme to use on first load:
 *  - if a cookie exists, honor it;
 *  - otherwise fall back to the OS preference and persist that choice.
 */
export function getInitialTheme(): Theme {
  const stored = readCookie();
  if (stored) return stored;
  const system = getSystemTheme();
  applyTheme(system);
  return system;
}

export function getStoredTheme(): Theme | null {
  return readCookie();
}
