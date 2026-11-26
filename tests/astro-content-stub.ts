// Vitest-only stand-in for the virtual `astro:content` module.
export async function getCollection(): Promise<{ id: string }[]> {
  return [];
}
