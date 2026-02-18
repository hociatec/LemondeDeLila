export type CanonicalPawn = {
  id: string;
  name: string;
  description: string;
};

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

export function loadCanonicalPawns(rawPawns: unknown): CanonicalPawn[] {
  const source = Array.isArray(rawPawns) ? rawPawns : [];
  return source
    .map((pawn: any) => {
      const id = normalizeText(pawn?.id);
      const name = normalizeText(pawn?.name);
      const description = normalizeText(pawn?.description);
      if (!id || !name) return null;
      return { id, name, description } as CanonicalPawn;
    })
    .filter(Boolean) as CanonicalPawn[];
}
