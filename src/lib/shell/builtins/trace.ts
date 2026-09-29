// `trace`: replays the last query_jared_memory retrieval (the query, facts above RAG_MIN_SCORE,
// and lower-scored candidates). Formatting lives in rag.ts (formatRagTrace), shared with the
// deck's `/trace` fallback.

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
