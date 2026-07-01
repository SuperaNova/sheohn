export type EvalCase = {
  name: string;
  prompt: string;
  expectedTool: string | null; // null = expect no tool call at all
  expectedFactsContain?: string[]; // only checked for query_jared_memory cases
};

export const evalCases: EvalCase[] = [
  {
    name: 'open_case_study — named project',
    prompt: 'Open the Crucible case study.',
    expectedTool: 'open_case_study',
  },
  {
    name: 'open_resume — resume request',
    prompt: 'Can I see his resume?',
    expectedTool: 'open_resume',
  },
  {
    name: 'focus_section — tech stack overview',
    prompt: "What's his tech stack?",
    expectedTool: 'focus_section',
  },
  {
    name: 'set_theme — dark mode',
    prompt: 'Switch to dark mode.',
    expectedTool: 'set_theme',
  },
  {
    name: 'trigger_ui_state — tech highlight',
    prompt: 'Show me his AI work.',
    expectedTool: 'trigger_ui_state',
  },
  {
    name: 'query_jared_memory — background question',
    prompt: "What is Jared's educational background?",
    expectedTool: 'query_jared_memory',
  },
  {
    name: 'plain conversation — off-topic decline',
    prompt: 'Tell me a joke about a random celebrity.',
    expectedTool: null,
  },
  {
    name: 'plain conversation — trivial math',
    prompt: 'What is 12 times 12?',
    expectedTool: null,
  },
  {
    name: 'query_jared_memory — education facts',
    prompt: 'Where does Jared go to school and what is he studying?',
    expectedTool: 'query_jared_memory',
    expectedFactsContain: ['CIT-U', 'Computer Science'],
  },
  {
    name: 'query_jared_memory — leadership facts',
    prompt: 'What leadership roles does Jared hold?',
    expectedTool: 'query_jared_memory',
    expectedFactsContain: ['GDG', 'President'],
  },
];
