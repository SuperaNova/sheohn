// Labelled queries for scripts/rag-eval.ts. `expectedFacts` are verbatim
// strings from scripts/my_facts.json; list several when any would be an
// acceptable answer. IDs are derived via hashFact, matching scripts/update-brain.ts.
import { hashFact } from '../src/lib/brain-diff';
import type { RagEvalCase } from '../src/lib/rag-eval';

export type LabeledQuery = {
  name: string;
  query: string;
  expectedFacts: string[];
};

export const labeledQueries: LabeledQuery[] = [
  {
    name: 'education — school and program',
    query: 'Where does Jared go to school and what is he studying?',
    expectedFacts: [
      'I am studying Bachelor of Science in Computer Science at Cebu Institute of Technology - University (Expected 2027).',
    ],
  },
  {
    name: 'education — general background',
    query: "What is Jared's educational background?",
    expectedFacts: [
      'I am studying Bachelor of Science in Computer Science at Cebu Institute of Technology - University (Expected 2027).',
    ],
  },
  {
    // Known ranking gap: the fact is indexed but this prompt has failed to surface it.
    name: 'leadership — roles held',
    query: 'What leadership roles does Jared hold?',
    expectedFacts: [
      'Since 2025, I am the President & Campus Organizer for Google Developer Group on Campus CIT-U.',
    ],
  },
  {
    name: 'stack — tech stack overview',
    query: "What's his tech stack?",
    expectedFacts: [
      'My tech stack languages include C++, Java, Python, Rust, TypeScript, JavaScript, Dart, SQL, and NoSQL.',
    ],
  },

  {
    name: 'identity — full name',
    query: "What is Jared's full name?",
    expectedFacts: ['My name is Jared Sheohn L. Acebes.'],
  },
  {
    name: 'identity — role/title',
    query: 'What is Jared professionally — what does he call himself?',
    expectedFacts: ['I am a Software Developer and Systems Architect.'],
  },
  {
    name: 'identity — GitHub handle',
    query: "What is Jared's GitHub username?",
    expectedFacts: ['My GitHub is github.com/SuperaNova.'],
  },
  {
    name: 'education — scholarships',
    query: 'Does Jared have any academic scholarships?',
    expectedFacts: [
      'I am a DOST-SEI Junior Level Science Scholarship (JLSS) Batch 2025 scholar.',
      'I have a CIT-U College Dance Troupe Scholarship.',
    ],
  },
  {
    name: 'experience — Ace-1 role',
    query: 'Where did Jared work and what was his job title?',
    expectedFacts: [
      'From March to December 2025, I worked as an AI Trainee Developer at Ace-1 IT Solutions.',
    ],
  },
  {
    name: 'experience — Ace-1 responsibilities',
    query: 'What did Jared actually build or do at Ace-1 IT Solutions?',
    expectedFacts: [
      'At Ace-1 IT Solutions, I developed backend systems and AI-driven workflows using n8n and LangChain, configured on-prem Docker servers and databases, and deployed cloud-based workflows.',
    ],
  },
  {
    name: 'leadership — AWS Cloud Club',
    query: "What is Jared's role in the AWS Cloud Club?",
    expectedFacts: [
      'Since 2025, I am the Network & Linkages Director for AWS Cloud Club - WildQuacc, facilitating 2 major tech events.',
    ],
  },
  {
    name: 'leadership — earthquake response volunteering',
    query: 'Did Jared do any volunteer or disaster-response work?',
    expectedFacts: [
      'In October 2025, I served as Management Information Team (MIT) Lead for Angat Bayanihan Volunteer Network, developing an information system for public data analysis during the 2025 Bogo earthquake.',
    ],
  },
  {
    name: 'projects — Crucible',
    query: 'Tell me about Crucible, the sprite synthesis project.',
    expectedFacts: [
      'I developed Crucible (2026), an Autonomous Sprite Synthesis Pipeline using Python, Gemini 3.1 Flash-Lite, Moondream2 (VLM), Flux.1, and Google ADK.',
    ],
  },
  {
    name: 'projects — Lexicon',
    query: 'What is Lexicon, the programming language project Jared built?',
    expectedFacts: [
      'I created Lexicon (2026), a Custom Programming Language Interpreter & Web IDE using Rust, WebAssembly (Wasm), React, and Astro.',
    ],
  },
  {
    name: 'projects — AniMo',
    query: 'What did Jared build for the GDG APAC Solutions Challenge?',
    expectedFacts: [
      'I built AniMo (2025) for the GDG on Campus APAC Solutions Challenge, using TypeScript, Dart, Flutter, Firebase, GCP, and Vertex AI.',
    ],
  },
  {
    name: 'stack — cloud and AI',
    query: 'What cloud and AI tools does Jared use?',
    expectedFacts: [
      'My cloud and AI stack includes GCP (Vertex/Gemini), Firebase, LangChain, n8n/Make, Docker, and Git/GitHub.',
    ],
  },
  {
    name: 'stack — data and analysis',
    query: 'What data analysis tools is Jared familiar with?',
    expectedFacts: [
      'My data and analysis stack includes Pandas, NumPy, Matplotlib, Jupyter Notebook, JSON/CSV, and Data Visualization.',
    ],
  },
];

/** Resolves a labelled query's fact text(s) into their indexed IDs. */
export function toRagEvalCase(labeled: LabeledQuery): RagEvalCase {
  return {
    name: labeled.name,
    query: labeled.query,
    expectedFactIds: labeled.expectedFacts.map(hashFact),
  };
}
