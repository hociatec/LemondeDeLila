import { parseStrictInteger } from '../../../../shared/utils/public-api';

/** The canonical subject identifies one user; a duplicate claim must agree. */
export function jwtUserId(payload: Record<string, unknown>): number | null {
  const id = parseStrictInteger(payload.sub, { min: 1 });
  if (id === null || payload.sub !== String(id)) return null;
  if (payload.id !== undefined && payload.id !== id) return null;
  return id;
}
