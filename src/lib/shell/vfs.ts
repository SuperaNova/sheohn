// A tiny in-memory virtual filesystem assembled from real repo data: the
// `projects` content collection (raw MDX/MD source, lazily loaded) and
// `personalInfo` (structured facts about Jared). Tree-building and
// path-resolution logic here is pure and takes its data as arguments so it
// can be unit tested without Vite's `import.meta.glob` — the real glob call
// lives at the bottom of this file, kept as thin as possible.

import { personalInfo } from '../../data/personalInfo';

interface VfsFileNode {
  type: 'file';
  name: string;
  path: string;
  /** Lazily resolves file contents — mirrors the `?raw` glob import shape. */
  read: () => Promise<string>;
}

export interface VfsDirNode {
  type: 'dir';
  name: string;
  path: string;
  children: Record<string, VfsNode>;
}

export type VfsNode = VfsFileNode | VfsDirNode;

export interface VfsEntry {
  name: string;
  type: 'file' | 'dir';
  path: string;
}

type PersonalInfo = typeof personalInfo;

/** A glob-result-shaped record: file path → lazy content loader. */
export type GlobRecord = Record<string, () => Promise<string>>;

function makeDir(path: string, name: string): VfsDirNode {
  return { type: 'dir', name, path, children: {} };
}

function makeFile(
  path: string,
  name: string,
  read: () => Promise<string>,
): VfsFileNode {
  return { type: 'file', name, path, read };
}

function addChild(parent: VfsDirNode, child: VfsNode): void {
  parent.children[child.name] = child;
}

/**
 * Flattens `personalInfo` into a short list of human-readable fact
 * sentences, sourced only from fields that actually exist on the object —
 * nothing invented. Backs `/facts.json`, in the spirit of
 * `scripts/my_facts.json` (which feeds the real RAG pipeline and isn't
 * importable from client code).
 */
export function buildFacts(info: PersonalInfo): string[] {
  const facts: string[] = [
    `${info.name} — ${info.title}, based in ${info.location}.`,
    `Education: ${info.education}.`,
    info.bio,
    info.strategicNote,
    `GitHub: ${info.socials.github}`,
    `LinkedIn: ${info.socials.linkedin}`,
    `Résumé: ${info.resumeUrl}`,
  ];
  for (const exp of info.experience) {
    facts.push(
      `${exp.date} — ${exp.role} @ ${exp.organization}: ${exp.description}`,
    );
  }
  for (const group of info.techStack) {
    facts.push(`${group.category}: ${group.items.join(', ')}`);
  }
  return facts;
}

/**
 * Builds the virtual filesystem tree. `projectFiles` mirrors the return
 * shape of `import.meta.glob(..., { query: '?raw', import: 'default' })`
 * (a map of source path → lazy string loader) so tests can inject a fake
 * record instead of relying on a real Vite glob.
 */
export function buildVfs(
  projectFiles: GlobRecord,
  info: PersonalInfo = personalInfo,
): VfsDirNode {
  const root = makeDir('/', '');

  const projectsDir = makeDir('/projects', 'projects');
  addChild(root, projectsDir);
  for (const [sourcePath, loader] of Object.entries(projectFiles)) {
    const filename = sourcePath.split('/').pop();
    if (!filename) continue;
    addChild(projectsDir, makeFile(`/projects/${filename}`, filename, loader));
  }

  const aboutDir = makeDir('/about', 'about');
  addChild(root, aboutDir);
  addChild(
    aboutDir,
    makeFile('/about/bio', 'bio', () => Promise.resolve(info.bio)),
  );
  addChild(
    aboutDir,
    makeFile('/about/experience.json', 'experience.json', () =>
      Promise.resolve(JSON.stringify(info.experience, null, 2)),
    ),
  );
  addChild(
    aboutDir,
    makeFile('/about/techstack.json', 'techstack.json', () =>
      Promise.resolve(JSON.stringify(info.techStack, null, 2)),
    ),
  );

  addChild(
    root,
    makeFile('/facts.json', 'facts.json', () =>
      Promise.resolve(JSON.stringify(buildFacts(info), null, 2)),
    ),
  );

  return root;
}

/**
 * Resolves `input` (absolute or relative, may contain `.`/`..`) against
 * `cwd` into a normalized absolute path. Purely string manipulation — does
 * not check whether the resulting path exists.
 */
export function resolvePath(cwd: string, input: string): string {
  if (!input) return cwd || '/';
  const isAbsolute = input.startsWith('/');
  const base = isAbsolute ? [] : cwd.split('/').filter(Boolean);
  const parts = input.split('/').filter(Boolean);
  const stack = [...base];
  for (const part of parts) {
    if (part === '.') continue;
    else if (part === '..') stack.pop();
    else stack.push(part);
  }
  return '/' + stack.join('/');
}

/** Looks up a node by absolute (or cwd-resolved) path. */
export function getNode(root: VfsDirNode, path: string): VfsNode | undefined {
  const segments = path.split('/').filter(Boolean);
  let node: VfsNode = root;
  for (const segment of segments) {
    if (node.type !== 'dir') return undefined;
    const next: VfsNode | undefined = node.children[segment];
    if (!next) return undefined;
    node = next;
  }
  return node;
}

/** Lists a directory's entries, sorted by name. `undefined` if not a dir. */
export function listDir(
  root: VfsDirNode,
  path: string,
): VfsEntry[] | undefined {
  const node = getNode(root, path);
  if (!node || node.type !== 'dir') return undefined;
  return Object.values(node.children)
    .map((c) => ({ name: c.name, type: c.type, path: c.path }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Reads a file's contents. `undefined` if the path isn't a file. */
export async function readFile(
  root: VfsDirNode,
  path: string,
): Promise<string | undefined> {
  const node = getNode(root, path);
  if (!node || node.type !== 'file') return undefined;
  return node.read();
}

// ── Real glob wiring (thin — kept out of the testable logic above) ────────
// Lazy by design: NOT `eager: true`, so each project's raw source is its own
// chunk, only fetched when a `cat`/`grep` actually reads it.
const projectFiles = import.meta.glob('/src/content/projects/*.{md,mdx}', {
  query: '?raw',
  import: 'default',
}) as GlobRecord;

export const vfsRoot: VfsDirNode = buildVfs(projectFiles, personalInfo);
