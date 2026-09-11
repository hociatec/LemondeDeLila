/** Required stored instant: missing/corrupt data is an error, never "now". */
export function requireStoredDate(value: unknown): Date {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new RangeError('Date persistée absente ou invalide');
  }
  return value;
}

export function serializeDate(value: unknown): string {
  return requireStoredDate(value).toISOString();
}

/** Public optional-field policy: both absent inputs serialize as explicit null. */
export function normalizeOptional<T>(value: T | null | undefined): T | null {
  return value ?? null;
}

/** Null/undefined both represent an absent optional instant on the wire. */
export function serializeOptionalDate(value: unknown): string | null {
  if (normalizeOptional(value) === null) return null;
  try {
    return serializeDate(value);
  } catch {
    return null;
  }
}

/** Explicit boundary conversions for the business clock's millisecond unit. */
export function businessMsToDate(value: number): Date {
  if (!Number.isFinite(value) || !Number.isSafeInteger(value)) {
    throw new RangeError('Instant métier invalide');
  }
  return requireStoredDate(new Date(value));
}

export function businessMsToIso(value: number): string {
  return businessMsToDate(value).toISOString();
}

/** Parses only instants carrying an explicit UTC designator or numeric offset. */
export function parseExplicitInstant(value: unknown): number | null {
  if (
    typeof value !== 'string' ||
    !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value.trim())
  ) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}
