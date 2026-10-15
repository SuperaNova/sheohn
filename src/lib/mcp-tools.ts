// Tool definitions for the public /mcp server. Everything returned is author-written content.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { personalInfo } from '../data/personalInfo';
import { secondsUntil, type LimitOutcome } from './chat-guard';
import type { RagQueryResult } from './rag';

const SITE_URL = 'https://www.sheohn.dev';
const MCP_SERVER_VERSION = '1.0.0';
export const MCP_TOOL_NAMES = [
  'list_projects',
  'get_project',
  'search_facts',
  'get_profile',
] as const;

const PROJECT_BODY_MAX_CHARS = 20_000;

export const searchQuerySchema = z.string().trim().min(1).max(200);

export interface McpProject {
  id: string;
  body?: string | undefined;
  data: {
    title: string;
    summary: string;
    category: string;
    stack: string[];
    status: string;
    role?: string | undefined;
    timeline?: string | undefined;
    order: number;
  };
}

export interface McpToolDeps {
  loadProjects: () => Promise<McpProject[]>;
  searchFacts: (query: string) => Promise<RagQueryResult>;
  isFactsCached: (query: string) => boolean;
  limitSearchIp: () => Promise<LimitOutcome | null>;
  limitSearchDaily: () => Promise<LimitOutcome | null>;
  onToolCall?: (toolName: string) => void;
  now?: () => number;
}

function toolResult(data: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data) }] };
}

function toolError(message: string): CallToolResult {
  return { isError: true, content: [{ type: 'text', text: message }] };
}

function summarizeProject(project: McpProject) {
  const { title, summary, category, stack, status, role, timeline } =
    project.data;
  return {
    slug: project.id,
    title,
    summary,
    category,
    stack,
    status,
    role,
    timeline,
    url: `${SITE_URL}/projects/${project.id}/`,
  };
}

export async function listProjects(deps: McpToolDeps): Promise<CallToolResult> {
  const projects = await deps.loadProjects();
  return toolResult(
    [...projects]
      .sort((a, b) => a.data.order - b.data.order)
      .map(summarizeProject),
  );
}

export async function getProject(
  deps: McpToolDeps,
  slug: string,
): Promise<CallToolResult> {
  const projects = await deps.loadProjects();
  const project = projects.find((p) => p.id === slug);
  if (!project) {
    return toolError(
      `Unknown project slug. Available slugs: ${projects.map((p) => p.id).join(', ')}`,
    );
  }
  return toolResult({
    ...summarizeProject(project),
    body: (project.body ?? '').slice(0, PROJECT_BODY_MAX_CHARS),
  });
}

function rateLimited(limit: LimitOutcome, nowMs: number): CallToolResult {
  return toolError(
    `Rate limited, retry in ${secondsUntil(limit.reset, nowMs)}s`,
  );
}

export async function searchFactsTool(
  deps: McpToolDeps,
  query: string,
): Promise<CallToolResult> {
  // Only a cache miss costs an embedding call, so only a miss spends limiter budget.
  if (!deps.isFactsCached(query)) {
    const nowMs = (deps.now ?? Date.now)();
    const ipLimit = await deps.limitSearchIp();
    if (ipLimit && !ipLimit.success) return rateLimited(ipLimit, nowMs);
    const dailyLimit = await deps.limitSearchDaily();
    if (dailyLimit && !dailyLimit.success)
      return rateLimited(dailyLimit, nowMs);
  }

  const { facts } = await deps.searchFacts(query);
  return toolResult({
    query,
    facts: facts.map((fact) => ({
      text: fact.text,
      score: Math.round(fact.score * 1000) / 1000,
    })),
  });
}

// Explicit allowlist: contact details never go through this object.
export function getProfile(): CallToolResult {
  return toolResult({
    name: personalInfo.name,
    title: personalInfo.title,
    location: personalInfo.location,
    siteUrl: SITE_URL,
    resumeUrl: personalInfo.resumeUrl,
    github: personalInfo.socials.github,
    linkedin: personalInfo.socials.linkedin,
  });
}

const READ_ONLY = { readOnlyHint: true, openWorldHint: false } as const;

/** Builds a fresh server; the route creates one per request (stateless transport). */
export function createMcpServer(deps: McpToolDeps): McpServer {
  const server = new McpServer(
    { name: 'sheohn', version: MCP_SERVER_VERSION },
    {
      instructions:
        'Read-only information about the work of Jared Acebes: projects, background and public links.',
    },
  );
  const track = (toolName: string) => deps.onToolCall?.(toolName);

  server.registerTool(
    'list_projects',
    {
      description: "List the case studies on Jared Acebes's portfolio.",
      annotations: READ_ONLY,
    },
    async () => {
      track('list_projects');
      return listProjects(deps);
    },
  );

  server.registerTool(
    'get_project',
    {
      description: 'Get one case study, including its full write-up.',
      inputSchema: { slug: z.string().min(1).max(100) },
      annotations: READ_ONLY,
    },
    async ({ slug }) => {
      track('get_project');
      return getProject(deps, slug);
    },
  );

  server.registerTool(
    'search_facts',
    {
      description:
        "Search the author-written facts about Jared's work, skills and background.",
      inputSchema: { query: searchQuerySchema },
      annotations: READ_ONLY,
    },
    async ({ query }) => {
      track('search_facts');
      return searchFactsTool(deps, query);
    },
  );

  server.registerTool(
    'get_profile',
    {
      description: "Get Jared Acebes's name, title, location and public links.",
      annotations: READ_ONLY,
    },
    async () => {
      track('get_profile');
      return getProfile();
    },
  );

  return server;
}
