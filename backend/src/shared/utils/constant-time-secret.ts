import { createHash, timingSafeEqual } from 'node:crypto';

/** Compare two non-empty secrets through fixed-size digests. */
export function constantTimeSecretEquals(
  expected: string,
  provided: string,
): boolean {
  if (!expected || !provided) return false;
  const digest = (value: string) =>
    createHash('sha256').update(value, 'utf8').digest();
  return timingSafeEqual(digest(expected), digest(provided));
}
