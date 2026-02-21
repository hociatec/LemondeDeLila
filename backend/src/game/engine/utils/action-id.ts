import { createHash } from 'crypto';

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null';

  const t = typeof value;
  if (t === 'string') return JSON.stringify(value);
  if (t === 'number')
    return Number.isFinite(value as number) ? String(value) : 'null';
  if (t === 'boolean') return (value as boolean) ? 'true' : 'false';

  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(',')}]`;
  }

  if (t === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return `{${keys
      .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
      .join(',')}}`;
  }

  return 'null';
}

export function computeActionId(type: string, payload: unknown): string {
  const t = String(type ?? '')
    .trim()
    .toLowerCase();
  const canonicalPayload = stableStringify(payload ?? null);
  const hex = createHash('sha256')
    .update(`${t}|${canonicalPayload}`, 'utf8')
    .digest('hex')
    .slice(0, 16);
  return `act_${hex}`;
}
