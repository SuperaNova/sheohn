// A small POSIX-flavored tokenizer for the pseudo-shell. Handles single and
// double quotes (quoted whitespace stays inside one token) and splits on
// unquoted `|` into pipeline stages. Deliberately does not support escape
// sequences, globbing, or redirection — this is a toy shell over a virtual
// filesystem, not a real one.

/**
 * Tokenize a raw input string into a pipeline of argv-style token arrays,
 * one array per `|`-separated stage. Empty stages (e.g. leading/trailing
 * pipes, or fully blank input) are dropped.
 */
export function tokenize(input: string): string[][] {
  const pipeline: string[][] = [];
  let stage: string[] = [];
  let token = '';
  let hasToken = false;
  let inSingle = false;
  let inDouble = false;

  const flushToken = () => {
    if (hasToken) {
      stage.push(token);
      token = '';
      hasToken = false;
    }
  };
  const flushStage = () => {
    flushToken();
    pipeline.push(stage);
    stage = [];
  };

  for (const ch of input) {
    if (inSingle) {
      if (ch === "'") inSingle = false;
      else token += ch;
      continue;
    }
    if (inDouble) {
      if (ch === '"') inDouble = false;
      else token += ch;
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      hasToken = true;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      hasToken = true;
      continue;
    }
    if (ch === '|') {
      flushStage();
      continue;
    }
    if (/\s/.test(ch)) {
      flushToken();
      continue;
    }
    token += ch;
    hasToken = true;
  }
  flushStage();

  return pipeline.filter((s) => s.length > 0);
}
