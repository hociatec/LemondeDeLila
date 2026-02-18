import type { FroussePawn } from './model/frousse.types';

export function resolvePawnId(raw: unknown): string | null {
  if (raw == null) return null;
  const value = String(raw ?? '').trim();
  return value.length > 0 ? value : null;
}

export function formatPawnChoiceLabel(pawn: FroussePawn): string {
  const name = String(pawn?.name ?? '').trim();
  const description = String(pawn?.description ?? '').trim();
  if (name && description) {
    return `${name}: ${description}`;
  }
  if (name) {
    return name;
  }
  if (description) {
    return description;
  }
  return String(pawn?.id ?? 'Pion');
}
