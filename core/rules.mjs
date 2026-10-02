// Shared by the authoritative world and sampled replay. Old exports lack grace.
export function safeRadiusAt(elapsed, duration, grace = 0) {
  const start = Math.max(0, Math.min(duration * 0.8, grace));
  return Math.max(1.6, 29 - (Math.max(0, elapsed - start) / (duration - start)) * 27.4);
}
