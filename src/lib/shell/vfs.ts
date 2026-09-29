// In-memory virtual filesystem over the `projects` collection and `personalInfo`. Logic is pure
// and takes its data as arguments so tests can skip Vite's `import.meta.glob` (wired at the bottom).

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

/** Flattens `personalInfo` into fact sentences for `/facts.json`; only existing fields, nothing invented. */
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

/** Builds the tree; `projectFiles` has the shape of `import.meta.glob(..., { query: '?raw' })`. */
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

/** Resolves `input` (absolute or relative, with `.`/`..`) against `cwd`; string-only, no existence check. */
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

// Lazy (not `eager`) so each project's source is its own chunk, fetched only on read.
const projectFiles = import.meta.glob('/src/content/projects/*.{md,mdx}', {
  query: '?raw',
  import: 'default',
}) as GlobRecord;

export const vfsRoot: VfsDirNode = buildVfs(projectFiles, personalInfo);
