export type CanonicalPawn = {
  id: string;
  name: string;
  description: string;
};

function normalizeText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim();
  }
  return '';
}

export function loadCanonicalPawns(rawPawns: unknown): CanonicalPawn[] {
  const source = Array.isArray(rawPawns) ? rawPawns : [];
  return source
    .map((pawn) => {
      const entry =
        pawn && typeof pawn === 'object'
          ? (pawn as Record<string, unknown>)
          : null;
      const id = normalizeText(entry?.id);
      const name = normalizeText(entry?.name);
      const description = normalizeText(entry?.description);
      if (!id || !name) return null;
      return { id, name, description } as CanonicalPawn;
    })
    .filter(Boolean) as CanonicalPawn[];
}
