import { createHash } from 'crypto';

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null';

  const t = typeof value;
  if (t === 'string') return JSON.stringify(value);
  if (t === 'number') {
    const numeric = value as number;
    return Number.isFinite(numeric) ? String(numeric) : 'null';
  }
  if (t === 'boolean') {
    const booleanValue = value as boolean;
    return booleanValue ? 'true' : 'false';
  }

  if (Array.isArray(value)) {
    const contents = value.map((v) => stableStringify(v)).join(',');
    return `[${contents}]`;
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
