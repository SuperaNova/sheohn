import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

type Theme = 'light' | 'dark';

function getPreferredTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  const saved = window.localStorage.getItem('theme');
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export default function ThemeToggle({
  compact = false,
}: {
  compact?: boolean;
}) {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    const nextTheme = getPreferredTheme();
    setTheme(nextTheme);
    document.documentElement.classList.toggle('dark', nextTheme === 'dark');
  }, []);

  const toggleTheme = () => {
    const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    document.documentElement.classList.toggle('dark', nextTheme === 'dark');
    window.localStorage.setItem('theme', nextTheme);
  };

  return (
    <motion.button
      type="button"
      onClick={toggleTheme}
      whileHover={{ y: -2, scale: 1.03 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 420, damping: 28 }}
      className={
        compact
          ? 'rounded-md bg-[var(--color-surface-container-high)] px-3 py-2 text-[11px] font-semibold tracking-[0.12em] text-[var(--color-on-surface)] shadow-[0_8px_20px_rgba(0,0,0,0.25)]'
          : 'glass-island fixed top-6 right-6 z-50 rounded-lg px-4 py-2 text-xs font-semibold tracking-[0.12em] text-[var(--color-on-surface)] shadow-[0_16px_32px_rgba(0,0,0,0.25)]'
      }
      aria-label="Toggle color theme"
    >
      {theme === 'dark' ? 'LIGHT MODE' : 'DARK MODE'}
    </motion.button>
  );
}
