const hits = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_HITS = 10;

export function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const list = (hits.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= MAX_HITS) {
    hits.set(userId, list);
    return false;
  }
  list.push(now);
  hits.set(userId, list);
  return true;
}
