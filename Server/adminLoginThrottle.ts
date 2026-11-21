interface AttemptState {
  count: number;
  windowStartedAt: number;
  blockedUntil: number;
}

const attemptState = new Map<string, AttemptState>();
const MAX_FAILURES = 8;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const BLOCK_DURATION_MS = 15 * 60 * 1000;

function expireOldEntries(now: number) {
  for (const [address, entry] of attemptState) {
    if (now >= entry.blockedUntil && now - entry.windowStartedAt >= ATTEMPT_WINDOW_MS * 2) {
      attemptState.delete(address);
    }
  }
  if (attemptState.size > 2000) {
    const first = attemptState.keys().next().value;
    if (first) attemptState.delete(first);
  }
}

export function isAdminLoginBlocked(address: string, now = Date.now()) {
  expireOldEntries(now);
  const entry = attemptState.get(address);
  if (!entry) return false;
  if (entry.blockedUntil > now) return true;
  if (now - entry.windowStartedAt >= ATTEMPT_WINDOW_MS) {
    attemptState.delete(address);
  }
  return false;
}

export function recordFailedAdminLogin(address: string, now = Date.now()) {
  const existing = attemptState.get(address);
  const entry = !existing || now - existing.windowStartedAt >= ATTEMPT_WINDOW_MS
    ? { count: 0, windowStartedAt: now, blockedUntil: 0 }
    : existing;
  entry.count += 1;
  if (entry.count >= MAX_FAILURES) entry.blockedUntil = now + BLOCK_DURATION_MS;
  attemptState.set(address, entry);
  expireOldEntries(now);
}

export function clearAdminLoginFailures(address: string) {
  attemptState.delete(address);
}
