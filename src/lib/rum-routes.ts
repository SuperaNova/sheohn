// Known-route allowlist shared by /api/vitals (reject anything else before a
// Redis write) and /stats (same list, so it reads back exactly what could
// have been written). Pure — no astro:content import — so callers pass in
// already-fetched project entries instead of this module fetching them.

export const STATIC_ROUTES = ['/', '/about', '/projects'] as const;

export interface ProjectRouteSource {
  id: string;
}

export function buildKnownRoutes(projects: ProjectRouteSource[]): string[] {
  return [...STATIC_ROUTES, ...projects.map((p) => `/projects/${p.id}`)];
}

/** Strips query string, hash, and a trailing slash so a beacon's route matches by path alone. */
export function normalizeRoute(raw: string): string {
  const path = (raw.split('#')[0] ?? '').split('?')[0] ?? '';
  if (path.length > 1 && path.endsWith('/')) {
    return path.slice(0, -1);
  }
  return path || '/';
}

export function isKnownRoute(
  route: string,
  knownRoutes: readonly string[],
): boolean {
  return knownRoutes.includes(normalizeRoute(route));
}
