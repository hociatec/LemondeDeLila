export type UserBanStatus = 'none' | 'expired' | 'active' | 'invalid';

export type UserBanState =
  | { status: 'active'; until: Date }
  | { status: Exclude<UserBanStatus, 'active'> };

export function userBanState(
  until: Date | null | undefined,
  nowMs: number,
): UserBanState {
  const status = userBanStatus(until, nowMs);
  if (status === 'active' && until instanceof Date) return { status, until };
  return { status: status === 'active' ? 'invalid' : status };
}

/** Null means no ban. A corrupt stored expiry must never grant access. */
export function userBanStatus(
  until: Date | null | undefined,
  nowMs: number,
): UserBanStatus {
  if (until == null) return 'none';
  if (
    !(until instanceof Date) ||
    !Number.isFinite(until.getTime()) ||
    !Number.isFinite(nowMs)
  )
    return 'invalid';
  return until.getTime() > nowMs ? 'active' : 'expired';
}

/** Date-only inputs mean midnight UTC; date-times must carry an explicit zone. */
export function parseUserBanUntil(value: string): Date {
  if (typeof value !== 'string' || value.length > 64) {
    throw new RangeError('Date de fin invalide');
  }
  const match =
    /^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/.exec(
      value,
    );
  if (!match) throw new RangeError('Date de fin invalide');
  const [, year, month, day] = match;
  const calendar = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  const parsed = new Date(value);
  if (
    !Number.isFinite(parsed.getTime()) ||
    !Number.isFinite(calendar.getTime()) ||
    calendar.toISOString().slice(0, 10) !== `${year}-${month}-${day}`
  ) {
    throw new RangeError('Date de fin invalide');
  }
  return parsed;
}

/** A moderation day is exactly 24 hours, independent of host timezone/DST. */
export function userBanUntilAfterDays(days: number, nowMs: number): Date {
  if (
    !Number.isSafeInteger(days) ||
    days < 1 ||
    days > 36_500 ||
    !Number.isFinite(nowMs)
  ) {
    throw new RangeError('Durée de bannissement invalide');
  }
  const until = new Date(nowMs + days * 86_400_000);
  if (!Number.isFinite(until.getTime()))
    throw new RangeError('Date de fin invalide');
  return until;
}
