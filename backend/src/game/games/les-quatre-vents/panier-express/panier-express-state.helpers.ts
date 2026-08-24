export function asRecord(value: unknown): Record<string, unknown> {
  if (value == null || typeof value !== 'object') return {};
  return value as Record<string, unknown>;
}

export function toText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

export function toPlayerIdValue(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function toUnknownArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function stringEqualsInsensitive(left: string, right: string): boolean {
  return left.localeCompare(right, 'fr', { sensitivity: 'base' }) === 0;
}

