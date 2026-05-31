export interface Starter {
  /** Short, action-phrased chip label. */
  label: string;
  /** The actual query sent to the agent (drives the page). */
  q: string;
}

// Starter prompts shown in the hero and the command deck's empty state.
// Each chip sends a real query to the agent, which then physically drives the
// page (pan / spotlight / open a case study). Single source of truth so the two
// surfaces never drift apart.
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
];
