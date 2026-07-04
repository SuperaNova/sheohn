import { expect, test } from 'vitest';
import {
  buildFacts,
  buildVfs,
  getNode,
  listDir,
  readFile,
  resolvePath,
  type GlobRecord,
} from './vfs';

const fakePersonalInfo = {
  name: 'Test Person',
  title: 'Tester',
  location: 'Nowhere',
  timezone: 'UTC',
  education: 'Testing U',
  bio: 'A person who tests things, including GDG-flavored fixtures.',
  strategicNote: 'Ships tests.',
  socials: { github: 'https://github.com/test', linkedin: 'https://li/test' },
  resumeUrl: 'https://example.com/resume.pdf',
  about: { paragraphs: [], currentFocusTitle: '', currentFocusDescription: '' },
  techStack: [{ category: 'Languages', items: ['TS', 'JS'] }],
  experience: [
    {
      id: 'exp-1',
      date: '2024',
      role: 'Tester',
      organization: 'Test Org',
      description: 'Tested things.',
      category: 'Experience',
    },
  ],
};

function fakeProjectFiles(): GlobRecord {
  return {
    '/src/content/projects/alpha.mdx': () => Promise.resolve('# Alpha content'),
    '/src/content/projects/beta.md': () => Promise.resolve('# Beta content'),
  };
}

test('buildVfs mounts project files as entries under /projects', () => {
  const root = buildVfs(fakeProjectFiles(), fakePersonalInfo);
  const entries = listDir(root, '/projects');
  expect(entries?.map((e) => e.name).sort()).toEqual(['alpha.mdx', 'beta.md']);
});

test('buildVfs exposes personalInfo under /about and /facts.json', async () => {
  const root = buildVfs(fakeProjectFiles(), fakePersonalInfo);
  expect(await readFile(root, '/about/bio')).toBe(fakePersonalInfo.bio);
  const factsRaw = await readFile(root, '/facts.json');
  expect(factsRaw).toBeDefined();
  expect(JSON.parse(factsRaw as string)).toEqual(buildFacts(fakePersonalInfo));
});

test('buildFacts includes real personalInfo fields, nothing invented', () => {
  const facts = buildFacts(fakePersonalInfo);
  expect(facts.some((f) => f.includes('GDG'))).toBe(true);
  expect(facts.some((f) => f.includes('Test Org'))).toBe(true);
});

test('resolvePath handles absolute paths', () => {
  expect(resolvePath('/projects', '/about')).toBe('/about');
});

test('resolvePath handles relative paths against cwd', () => {
  expect(resolvePath('/projects', 'alpha.mdx')).toBe('/projects/alpha.mdx');
});

test('resolvePath handles "." as a no-op segment', () => {
  expect(resolvePath('/projects', './alpha.mdx')).toBe('/projects/alpha.mdx');
});

test('resolvePath handles ".." to go up a directory', () => {
  expect(resolvePath('/projects', '..')).toBe('/');
  expect(resolvePath('/about', '../projects')).toBe('/projects');
});

test('resolvePath does not underflow past root', () => {
  expect(resolvePath('/', '..')).toBe('/');
});

test('resolvePath treats empty input as a no-op', () => {
  expect(resolvePath('/about', '')).toBe('/about');
});

test('getNode finds the root directory at "/"', () => {
  const root = buildVfs(fakeProjectFiles(), fakePersonalInfo);
  expect(getNode(root, '/')).toBe(root);
});

test('getNode returns undefined for a missing path', () => {
  const root = buildVfs(fakeProjectFiles(), fakePersonalInfo);
  expect(getNode(root, '/nope')).toBeUndefined();
});

test('listDir returns undefined when the path is a file, not a dir', async () => {
  const root = buildVfs(fakeProjectFiles(), fakePersonalInfo);
  expect(listDir(root, '/about/bio')).toBeUndefined();
});

test('readFile returns undefined when the path is a dir, not a file', async () => {
  const root = buildVfs(fakeProjectFiles(), fakePersonalInfo);
  expect(await readFile(root, '/projects')).toBeUndefined();
});

test('readFile lazily resolves project source content', async () => {
  const root = buildVfs(fakeProjectFiles(), fakePersonalInfo);
  expect(await readFile(root, '/projects/alpha.mdx')).toBe('# Alpha content');
});
