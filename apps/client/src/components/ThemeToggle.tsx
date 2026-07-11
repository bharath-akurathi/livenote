import { Moon, Sun } from 'lucide-react';
import { useThemeStore } from '../stores/themeStore';

/**
 * Light/Dark theme toggle.
 * - Shows the icon of the mode it will switch *to*.
 * - Accessible: native button with aria-label + aria-pressed, visible focus ring.
 */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const theme = useThemeStore((s) => s.theme);
  const toggle = useThemeStore((s) => s.toggle);
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={isDark}
      title={isDark ? 'Light mode' : 'Dark mode'}
      className={`p-2 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 ${className}`}
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
