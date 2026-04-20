export function toMetadata(target: {
  metadata?: unknown;
}): Record<string, unknown> {
  const meta = target.metadata;
  if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
    return meta as Record<string, unknown>;
  }
  return {};
}

export function normalizeMetadataString(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim();
  }
  return '';
}

export function parseMetadataNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim();
    if (!normalized) {
      return null;
    }
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function getMetadataObject(
  metadata: Record<string, unknown>,
  key: string,
): Record<string, unknown> | null {
  const value = metadata[key];
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

export function tryReadWinnerId(meta: Record<string, unknown>): number | null {
  for (const key of ['winnerId', 'winnerPlayerId', 'winner_id']) {
    const raw = meta[key];
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      return raw;
    }
    if (typeof raw === 'string' && raw.trim().length > 0) {
      const n = Number(raw.trim());
      if (Number.isFinite(n)) {
        return n;
      }
    }
  }

  return null;
}

export function tryReadOutcomesByPlayerId(
  meta: Record<string, unknown>,
): Record<string, 'won' | 'lost'> | null {
  const rawOutcomes = meta.outcomesByPlayerId;
  if (!rawOutcomes || typeof rawOutcomes !== 'object') {
    return null;
  }

  const out: Record<string, 'won' | 'lost'> = {};
  for (const [key, value] of Object.entries(
    rawOutcomes as Record<string, unknown>,
  )) {
    const normalized = normalizeMetadataString(value).toLowerCase();
    if (normalized !== 'won' && normalized !== 'lost') {
      continue;
    }
    out[String(key)] = normalized;
  }

  return Object.keys(out).length > 0 ? out : null;
}
