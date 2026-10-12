// POSIX-flavored tokenizer for the pseudo-shell: single/double quotes and `|` pipeline stages;
// no escapes, globbing, or redirection.

/** Tokenizes input into argv-style arrays, one per `|` stage; empty stages are dropped. */
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
