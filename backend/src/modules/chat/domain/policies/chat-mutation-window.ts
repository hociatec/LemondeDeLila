/** The deadline is inclusive; corrupt or future creation times never grant access. */
export function isChatMutationWindowOpen(
  createdAtMs: number,
  nowMs: number,
  windowSeconds: number,
): boolean {
  const ageMs = nowMs - createdAtMs;
  const windowMs = windowSeconds * 1000;
  return (
    Number.isFinite(createdAtMs) &&
    Number.isFinite(nowMs) &&
    Number.isFinite(ageMs) &&
    Number.isFinite(windowMs) &&
    windowMs > 0 &&
    ageMs >= 0 &&
    ageMs <= windowMs
  );
}
