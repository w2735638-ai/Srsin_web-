interface AttemptState {
  count: number;
  windowStartedAt: number;
  blockedUntil: number;
}

const attempts = new Map<string, AttemptState>();
const MAX_FAILURES = 10;
const WINDOW_MS = 15 * 60 * 1000;
const BLOCK_MS = 15 * 60 * 1000;

function prune(now: number) {
  for (const [key, value] of attempts) {
    if (now >= value.blockedUntil && now - value.windowStartedAt >= WINDOW_MS * 2) attempts.delete(key);
  }
  if (attempts.size > 5000) {
    const first = attempts.keys().next().value;
    if (first) attempts.delete(first);
  }
}

export function isReaderLoginBlocked(key: string, now = Date.now()) {
  prune(now);
  const entry = attempts.get(key);
  if (!entry) return false;
  if (entry.blockedUntil > now) return true;
  if (now - entry.windowStartedAt >= WINDOW_MS) attempts.delete(key);
  return false;
}

export function recordReaderLoginFailure(key: string, now = Date.now()) {
  const existing = attempts.get(key);
  const entry = !existing || now - existing.windowStartedAt >= WINDOW_MS
    ? { count: 0, windowStartedAt: now, blockedUntil: 0 }
    : existing;
  entry.count += 1;
  if (entry.count >= MAX_FAILURES) entry.blockedUntil = now + BLOCK_MS;
  attempts.set(key, entry);
  prune(now);
}

export function clearReaderLoginFailures(key: string) {
  attempts.delete(key);
}
