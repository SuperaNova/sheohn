// Pure telemetry logic for /api/chat; Redis I/O lives in agent-redis.ts.

import {
  bucketForBoundaries,
  estimatePercentile,
  type BucketBoundary,
} from './rum-metrics';

/** The tool set exposed to the model in src/pages/api/chat.ts. */
export const AGENT_TOOL_NAMES = [
  'open_case_study',
  'open_resume',
  'focus_section',
  'set_theme',
  'trigger_ui_state',
  'query_jared_memory',
] as const;

export type AgentToolName = (typeof AGENT_TOOL_NAMES)[number];

export function isAgentToolName(name: string): name is AgentToolName {
  return (AGENT_TOOL_NAMES as readonly string[]).includes(name);
}

// Sized for chat turns (seconds), capped by the route's 25s timeout.
const LATENCY_BOUNDARIES: BucketBoundary[] = [
  { min: 0, max: 1000, label: '0-1000' },
  { min: 1000, max: 3000, label: '1000-3000' },
  { min: 3000, max: 8000, label: '3000-8000' },
  { min: 8000, max: 15000, label: '8000-15000' },
  { min: 15000, max: Infinity, label: '15000+' },
];

export function latencyBucketFor(durationMs: number): string {
  return bucketForBoundaries(LATENCY_BOUNDARIES, durationMs);
}

export interface LatencyPercentiles {
  p50: number;
  p95: number;
}

const EMPTY_LATENCY: LatencyPercentiles = { p50: 0, p95: 0 };

export function estimateLatencyPercentiles(
  buckets: Record<string, number>,
): LatencyPercentiles {
  return {
    p50: estimatePercentile(buckets, LATENCY_BOUNDARIES, 0.5),
    p95: estimatePercentile(buckets, LATENCY_BOUNDARIES, 0.95),
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export interface RequestStats {
  total: number;
  rejected: number;
  /** Percentage (0-100) of total requests throttled by the rate limiter. */
  rejectionRate: number;
}

export function buildRequestStats(
  total: number,
  rejected: number,
): RequestStats {
  return {
    total,
    rejected,
    rejectionRate: total === 0 ? 0 : round1((rejected / total) * 100),
  };
}

export interface CacheStats {
  hits: number;
  misses: number;
  /** Percentage (0-100) of query_jared_memory calls served from ragCache. */
  hitRate: number;
}

export function buildCacheStats(hits: number, misses: number): CacheStats {
  const total = hits + misses;
  return {
    hits,
    misses,
    hitRate: total === 0 ? 0 : round1((hits / total) * 100),
  };
}

export interface ToolCallCount {
  name: AgentToolName;
  count: number;
}

/** Every known tool, in a fixed order, defaulting to 0 for tools never called. */
export function buildToolCallDistribution(
  counts: Record<string, number>,
): ToolCallCount[] {
  return AGENT_TOOL_NAMES.map((name) => ({ name, count: counts[name] ?? 0 }));
}

/** Tool names across every step of a turn, in call order. */
export function collectToolNames(
  steps: readonly { toolCalls: readonly { toolName: string }[] }[],
): string[] {
  return steps.flatMap((step) => step.toolCalls.map((call) => call.toolName));
}

export interface AgentStats {
  requests: RequestStats;
  toolCalls: ToolCallCount[];
  latency: LatencyPercentiles;
  cache: CacheStats;
}

export const EMPTY_AGENT_STATS: AgentStats = {
  requests: { total: 0, rejected: 0, rejectionRate: 0 },
  toolCalls: buildToolCallDistribution({}),
  latency: EMPTY_LATENCY,
  cache: { hits: 0, misses: 0, hitRate: 0 },
};

/** Assembles the full /stats panel shape from merged multi-day Redis hash reads. */
export function buildAgentStats(input: {
  totalRequests: number;
  rejectedRequests: number;
  toolCounts: Record<string, number>;
  latencyBuckets: Record<string, number>;
  cacheHits: number;
  cacheMisses: number;
}): AgentStats {
  return {
    requests: buildRequestStats(input.totalRequests, input.rejectedRequests),
    toolCalls: buildToolCallDistribution(input.toolCounts),
    latency: estimateLatencyPercentiles(input.latencyBuckets),
    cache: buildCacheStats(input.cacheHits, input.cacheMisses),
  };
}
