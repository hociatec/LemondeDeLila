import { GamePayloadValidationError } from '../../domain/errors/game-domain.errors';
import { parseStrictInteger } from '../../../../shared/utils/public-api';

type PayloadRecord = Record<string, unknown>;

function asPayloadRecord(payload: unknown): PayloadRecord {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return payload as PayloadRecord;
  }
  return {};
}

function toPayloadText(value: unknown): string {
  if (typeof value === 'string') return value.slice(0, 2_000);
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

export function requiredInt(
  payload: unknown,
  key: string,
  message?: string,
): number {
  const value = parseStrictInteger(asPayloadRecord(payload)[key]);
  if (value === null) {
    throw new GamePayloadValidationError(message ?? `${key} est requis.`);
  }
  return value;
}

export function optionalInt(payload: unknown, key: string): number | undefined {
  const raw = asPayloadRecord(payload)[key];
  if (raw == null || raw === '') return undefined;
  const value = parseStrictInteger(raw);
  if (value === null) {
    throw new GamePayloadValidationError(`${key} est invalide.`);
  }
  return value;
}

export function requiredString(
  payload: unknown,
  key: string,
  message?: string,
): string {
  const value = toPayloadText(asPayloadRecord(payload)[key]).trim();
  if (!value) {
    throw new GamePayloadValidationError(message ?? `${key} est requis.`);
  }
  return value;
}

export function optionalString(
  payload: unknown,
  key: string,
): string | undefined {
  const raw = asPayloadRecord(payload)[key];
  if (raw == null) return undefined;
  const value = toPayloadText(raw).trim();
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
    throw new GamePayloadValidationError(message ?? `${key} est invalide.`);
  }
  return value;
}

export function requiredArrayIndex(
  payload: unknown,
  key: string,
  length: number,
  message?: string,
): number {
  if (!Number.isSafeInteger(length) || length < 0 || length > 10_000) {
    throw new GamePayloadValidationError(message ?? `${key} est hors limites.`);
  }
  const index = requiredInt(payload, key, message);
  if (index < 0 || index >= Math.max(0, Math.trunc(length))) {
    throw new GamePayloadValidationError(message ?? `${key} est hors limites.`);
  }
  return index;
}
