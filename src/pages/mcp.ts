import { waitUntil } from '@vercel/functions';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { createRateLimiter, readKillSwitch, safeLimit } from '../lib/ratelimit';
import { decideMcpAdmission } from '../lib/mcp-guard';
import { createMcpServer } from '../lib/mcp-tools';
import { isFactsCached, searchFacts } from '../lib/rag-search';
import { recordMcpToolCall } from '../lib/agent-redis';

/**
 * Public read-only MCP server (/mcp). Stateless Streamable HTTP: a fresh server and
 * transport per request, JSON responses only. Tools live in src/lib/mcp-tools.ts.
 */
export const prerender = false;

const ipRatelimit = createRateLimiter('ratelimit_mcp', 30, '1 m');
// Each search cache miss costs a Gemini embedding call, so search gets its own budgets.
const searchIpRatelimit = createRateLimiter('ratelimit_mcp_search', 10, '1 m');
const searchDailyRatelimit = createRateLimiter(
  'ratelimit_mcp_search_daily',
  300,
  '1 d',
  'fixed',
);

function jsonResponse(
  body: unknown,
  status: number,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  // Trust only the platform-derived client address; x-forwarded-for is client-spoofable.
  const ip = clientAddress ?? '127.0.0.1';
  const admission = await decideMcpAdmission(
    {
      origin: request.headers.get('origin'),
      contentType: request.headers.get('content-type'),
    },
    {
      isDev: import.meta.env.DEV,
      readBody: () => request.text(),
      limitIp: () => safeLimit(ipRatelimit, `ratelimit_mcp_${ip}`),
      readKillSwitch,
    },
  );

  if (!admission.admit) {
    const headers: Record<string, string> = {};
    if (admission.retryAfterSeconds !== undefined) {
      headers['Retry-After'] = admission.retryAfterSeconds.toString();
    }
    return jsonResponse(
      {
        reason: admission.reason,
        retryAfterSeconds: admission.retryAfterSeconds,
      },
      admission.status,
      headers,
    );
  }

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(admission.body);
  } catch {
    return jsonResponse(
      {
        jsonrpc: '2.0',
        error: { code: -32700, message: 'Parse error' },
        id: null,
      },
      400,
    );
  }

  const server = createMcpServer({
    loadProjects: () => getCollection('projects'),
    searchFacts,
    isFactsCached,
    limitSearchIp: () =>
      safeLimit(searchIpRatelimit, `ratelimit_mcp_search_${ip}`),
    limitSearchDaily: () => safeLimit(searchDailyRatelimit, 'global'),
    onToolCall: (toolName) => waitUntil(recordMcpToolCall(toolName)),
  });
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  try {
    await server.connect(transport);
    return await transport.handleRequest(request, { parsedBody });
  } catch (err) {
    console.error('[mcp] request failed:', err);
    return jsonResponse(
      {
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      },
      500,
    );
  } finally {
    await server.close().catch(() => undefined);
  }
};

// No SSE stream and no sessions: every other method is rejected.
export const ALL: APIRoute = () =>
  jsonResponse(
    {
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Method not allowed.' },
      id: null,
    },
    405,
    { Allow: 'POST' },
  );
