type PayloadRecord = Record<string, unknown>;

function asPayloadRecord(payload: unknown): PayloadRecord {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return payload as PayloadRecord;
  }
  return {};
}

export function requiredInt(
  payload: unknown,
  key: string,
  message?: string,
): number {
  const value = Number(asPayloadRecord(payload)[key]);
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new Error(message ?? `${key} est requis.`);
  }
  return value;
}

export function optionalInt(
  payload: unknown,
  key: string,
): number | undefined {
  const raw = asPayloadRecord(payload)[key];
  if (raw == null || raw === '') return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new Error(`${key} est invalide.`);
  }
  return value;
}

export function requiredString(
  payload: unknown,
  key: string,
  message?: string,
): string {
  const value = String(asPayloadRecord(payload)[key] ?? '').trim();
  if (!value) {
    throw new Error(message ?? `${key} est requis.`);
  }
  return value;
}

export function optionalString(
  payload: unknown,
  key: string,
): string | undefined {
  const raw = asPayloadRecord(payload)[key];
  if (raw == null) return undefined;
  const value = String(raw).trim();
  return value || undefined;
}

export function requiredEnumValue<T extends string>(
  payload: unknown,
  key: string,
  allowed: readonly T[],
  message?: string,
): T {
  const value = requiredString(payload, key, message) as T;
  if (!allowed.includes(value)) {
    throw new Error(message ?? `${key} est invalide.`);
  }
  return value;
}

export function requiredArrayIndex(
  payload: unknown,
  key: string,
  length: number,
  message?: string,
): number {
  const index = requiredInt(payload, key, message);
  if (index < 0 || index >= Math.max(0, Math.trunc(length))) {
    throw new Error(message ?? `${key} est hors limites.`);
  }
  return index;
}
