export interface Starter {
  /** Short, action-phrased chip label. */
  label: string;
  /** The actual query sent to the agent (drives the page). */
  q: string;
  /** Hide the chip while the site is already in dark mode. */
  hideWhenDark?: boolean;
}

// Starter prompts for the hero and the deck's empty state; each chip sends a real agent query.
// Single source of truth for both surfaces.
export const starters: Starter[] = [
  {
    label: 'show me what he built',
    q: 'What has Jared built? Show me his projects.',
  },
  {
    label: 'show me his resume',
    q: 'Can I see your resume?',
  },
  { label: "what's his stack?", q: 'What is his tech stack?' },
  { label: 'is he available?', q: 'Is Jared available for opportunities?' },
  {
    label: 'power on the instrument',
    q: 'Power on the instrument — switch the site to dark mode.',
    hideWhenDark: true,
  },
];
