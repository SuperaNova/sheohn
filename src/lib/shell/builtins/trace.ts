// `trace`: replays the last turn's query_jared_memory retrieval pipeline —
// the query, the facts that cleared RAG_MIN_SCORE (what grounded the
// agent's answer / became footnote citations), and the candidates that
// scored below it. Spec #03's locked design: the actual formatting lives in
// src/lib/rag.ts (formatRagTrace) so this builtin and CommandDeck's `/trace`
// slash-command fallback render identical output.

import type { Command, ShellOutput } from '../registry';
import { formatRagTrace } from '../../rag';

export const trace: Command = {
  name: 'trace',
  description:
    "Replay the last turn's RAG retrieval pipeline (query, kept facts, filtered-out candidates).",
  usage: 'trace',
  run: (_args, ctx): ShellOutput => {
    return { lines: formatRagTrace(ctx.getLastRagTrace?.() ?? null) };
  },
};
