import type { GameStateEntity } from '../../../../../application/models/game-state.model';
import type { JeuOiePawn } from '../../model/jeu-oie-state.model';

export function normalizeJeuOiePawnChoice(
  pawn: JeuOiePawn | null | undefined,
): JeuOiePawn {
  return {
    id: String(pawn?.id ?? '').trim(),
    label: String(pawn?.label ?? '').trim(),
    feminine: Boolean(pawn?.feminine),
  };
}

export function lowercaseJeuOieFirst(value: string): string {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length === 1
    ? text.toLowerCase()
    : `${text.charAt(0).toLowerCase()}${text.slice(1)}`;
}

export function compactJeuOieTileLabel(
  label: string,
  position: number,
): string {
  const text = String(label ?? '').trim();
  if (!text) return `case ${position}`;
  return text.replace(/^case\s+\d+\s*[:-]?\s*/i, '').trim() || `case ${position}`;
}

export function describeJeuOiePawnLabel(
  state: GameStateEntity,
  playerId: number,
): string {
  const players = Array.isArray(state.players) ? state.players : [];
  const player = players.find((entry) => entry?.id === playerId) ?? null;
  const pawn = typeof player?.pawn === 'string' ? String(player.pawn).trim() : '';
  return pawn || 'pion';
}

export function describeJeuOiePawnPossessiveLabel(
  state: GameStateEntity,
  playerId: number,
): string {
  const label = describeJeuOiePawnLabel(state, playerId);
  const lowered = lowercaseJeuOieFirst(label);
  return /^sa |^son |^ses /i.test(lowered) ? lowered : `son ${lowered}`;
}
