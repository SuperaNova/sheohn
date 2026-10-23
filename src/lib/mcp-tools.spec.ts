import { describe, expect, test, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { personalInfo } from '../data/personalInfo';
import type { LimitOutcome } from './chat-guard';
import {
  MCP_TOOL_NAMES,
  createMcpServer,
  getProfile,
  getProject,
  listProjects,
  searchFactsTool,
  searchQuerySchema,
  type McpProject,
  type McpToolDeps,
} from './mcp-tools';

const NOW = 1_000_000;
const pass: LimitOutcome = {
  success: true,
  limit: 10,
  remaining: 9,
  reset: NOW + 60_000,
};
const fail: LimitOutcome = {
  success: false,
  limit: 10,
  remaining: 0,
  reset: NOW + 7_000,
};

const projects: McpProject[] = [
  {
    id: 'second',
    body: 'b'.repeat(25_000),
    data: {
      title: 'Second',
      summary: 'two',
      category: 'Web',
      stack: ['TS'],
      status: 'Live',
      order: 2,
    },
  },
  {
    id: 'first',
    body: 'first body',
    data: {
      title: 'First',
      summary: 'one',
      category: 'AI',
      stack: ['Python'],
      status: 'Shipped',
      role: 'Lead',
      timeline: '2025',
      order: 1,
    },
  },
];

function makeDeps(overrides: Partial<McpToolDeps> = {}): McpToolDeps {
  return {
    loadProjects: vi.fn(async () => projects),
    searchFacts: vi.fn(async (query: string) => ({
      query,
      facts: [{ id: 'a', text: 'kept fact', score: 0.912345 }],
      filteredOut: [{ id: 'b', text: 'dropped fact', score: 0.3 }],
    })),
    isFactsCached: vi.fn(() => false),
    limitSearchIp: vi.fn(async () => pass as LimitOutcome | null),
    limitSearchDaily: vi.fn(async () => pass as LimitOutcome | null),
    now: () => NOW,
    ...overrides,
  };
}

function textOf(result: { content?: unknown }): string {
  const [first] = result.content as { type: string; text: string }[];
  return first?.text ?? '';
}

describe('get_profile', () => {
  test('has no email or phone key and none of the contact values', () => {
    const text = textOf(getProfile());
    const profile = JSON.parse(text) as Record<string, unknown>;
    expect(Object.keys(profile).sort()).toEqual([
      'github',
      'linkedin',
      'location',
      'name',
      'resumeUrl',
      'siteUrl',
      'title',
    ]);
    expect(profile).not.toHaveProperty('email');
    expect(profile).not.toHaveProperty('phone');
    const personal = personalInfo as Record<string, unknown>;
    for (const key of ['email', 'phone']) {
      if (typeof personal[key] === 'string') {
        expect(text).not.toContain(personal[key]);
      }
    }
    expect(text).not.toMatch(/@[a-z0-9-]+\.[a-z]{2,}/i);
  });
});

describe('list_projects', () => {
  test('sorts by order and adds absolute urls', async () => {
    const result = await listProjects(makeDeps());
    const list = JSON.parse(textOf(result)) as { slug: string; url: string }[];
    expect(list.map((p) => p.slug)).toEqual(['first', 'second']);
    expect(list[0]?.url).toBe('https://www.sheohn.dev/projects/first/');
    expect(textOf(result)).not.toContain('first body');
  });
});

describe('get_project', () => {
  test('an unknown slug is a tool error, not a throw', async () => {
    const result = await getProject(makeDeps(), 'nope');
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('first');
  });

  test('returns the body capped at 20,000 chars', async () => {
    const result = await getProject(makeDeps(), 'second');
    expect(result.isError).toBeUndefined();
    const project = JSON.parse(textOf(result)) as { body: string };
    expect(project.body).toHaveLength(20_000);
  });
});

describe('search_facts', () => {
  test('the query schema rejects 201 chars and accepts 200', () => {
    expect(searchQuerySchema.safeParse('x'.repeat(201)).success).toBe(false);
    expect(searchQuerySchema.safeParse('x'.repeat(200)).success).toBe(true);
    expect(searchQuerySchema.safeParse('   ').success).toBe(false);
  });

  test('returns only kept facts with scores rounded to 3 decimals', async () => {
    const result = await searchFactsTool(makeDeps(), 'stack');
    const text = textOf(result);
    expect(text).not.toContain('dropped fact');
    expect(text).not.toContain('filteredOut');
    expect(JSON.parse(text)).toEqual({
      query: 'stack',
      facts: [{ text: 'kept fact', score: 0.912 }],
    });
  });

  test('does not consult the limiters on a cache hit', async () => {
    const deps = makeDeps({ isFactsCached: vi.fn(() => true) });
    await searchFactsTool(deps, 'stack');
    expect(deps.limitSearchIp).not.toHaveBeenCalled();
    expect(deps.limitSearchDaily).not.toHaveBeenCalled();
    expect(deps.searchFacts).toHaveBeenCalledOnce();
  });

  test('consults both limiters on a miss', async () => {
    const deps = makeDeps();
    await searchFactsTool(deps, 'stack');
    expect(deps.limitSearchIp).toHaveBeenCalledOnce();
    expect(deps.limitSearchDaily).toHaveBeenCalledOnce();
  });

  test('a rejected IP limiter is a rate-limit tool error and skips the search', async () => {
    const deps = makeDeps({ limitSearchIp: vi.fn(async () => fail) });
    const result = await searchFactsTool(deps, 'stack');
    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe('Rate limited, retry in 7s');
    expect(deps.limitSearchDaily).not.toHaveBeenCalled();
    expect(deps.searchFacts).not.toHaveBeenCalled();
  });

  test('a rejected daily limiter is a rate-limit tool error', async () => {
    const deps = makeDeps({ limitSearchDaily: vi.fn(async () => fail) });
    const result = await searchFactsTool(deps, 'stack');
    expect(result.isError).toBe(true);
    expect(deps.searchFacts).not.toHaveBeenCalled();
  });
});

describe('createMcpServer', () => {
  async function connect(deps: McpToolDeps) {
    const server = createMcpServer(deps);
    const client = new Client({ name: 'test', version: '0.0.0' });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);
    return client;
  }

  test('lists exactly the four read-only tools', async () => {
    const client = await connect(makeDeps());
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([...MCP_TOOL_NAMES].sort());
    for (const tool of tools) {
      expect(tool.annotations).toMatchObject({
        readOnlyHint: true,
        openWorldHint: false,
      });
    }
  });

  test('rejects a 201-char search query at the protocol layer', async () => {
    const deps = makeDeps();
    const client = await connect(deps);
    const outcome = await client
      .callTool({
        name: 'search_facts',
        arguments: { query: 'x'.repeat(201) },
      })
      .then((result) => Boolean(result.isError))
      .catch(() => true);
    expect(outcome).toBe(true);
    expect(deps.searchFacts).not.toHaveBeenCalled();
  });

  test('reports each tool call to onToolCall', async () => {
    const onToolCall = vi.fn();
    const client = await connect(makeDeps({ onToolCall }));
    await client.callTool({ name: 'get_profile', arguments: {} });
    expect(onToolCall).toHaveBeenCalledWith('get_profile');
  });
});
