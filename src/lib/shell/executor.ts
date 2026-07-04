// Runs a tokenized pipeline against the command registry, piping each
// stage's stdout into the next stage's stdin as a single joined string.

import { tokenize } from './lexer';
import { getCommand, type ShellCtx, type ShellOutput } from './registry';
// Side-effect import: registers every builtin (ls, cat, grep, the six
// aliases, ...) into the shared registry the first time this module loads.
import './builtins/index';

export interface ExecutionResult {
  /** False when the first pipeline stage isn't a known command — the
   * caller (CommandDeck) should fall through to the LLM agent in that case. */
  recognized: boolean;
  output: ShellOutput;
}

const UNRECOGNIZED: ExecutionResult = {
  recognized: false,
  output: { lines: [] },
};

export async function execute(
  input: string,
  ctx: ShellCtx,
): Promise<ExecutionResult> {
  const pipeline = tokenize(input);
  if (pipeline.length === 0) {
    return { recognized: true, output: { lines: [] } };
  }

  const firstStage = pipeline[0];
  const firstName = firstStage?.[0];
  if (!firstName || !getCommand(firstName)) {
    return UNRECOGNIZED;
  }

  let stdin: string | undefined;
  let lines: string[] = [];
  let hadError = false;

  for (const stage of pipeline) {
    const [name, ...args] = stage;
    const cmd = name ? getCommand(name) : undefined;
    if (!cmd) {
      lines = [`${name}: command not found`];
      hadError = true;
      break;
    }
    try {
      const result = await cmd.run(args, ctx, stdin);
      lines = result.lines;
      hadError = hadError || !!result.error;
      if (hadError) break;
      stdin = result.lines.join('\n');
    } catch (err) {
      lines = [`${name}: ${err instanceof Error ? err.message : String(err)}`];
      hadError = true;
      break;
    }
  }

  return { recognized: true, output: { lines, error: hadError } };
}
