import type { GameStateEntity } from '../../../../../application/models/game-state.model';

export function asPiratesEnVadrouilleRecord(
  value: unknown,
): Record<string, unknown> {
  return value != null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

export function describePiratesEnVadrouillePawnLabel(
  state: GameStateEntity,
  playerId: number,
): string {
  const players = Array.isArray(state.players) ? state.players : [];
  const player = players.find((entry) => entry?.id === playerId) ?? null;
  const pawn =
    typeof player?.pawn === 'string' ? String(player.pawn).trim() : '';
  if (!pawn) return '"son pion"';
  const lower = pawn.toLowerCase();
  const feminine = lower.startsWith('la ') || lower.startsWith('une ');
  const inner = pawn
    .replace(/^l['ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢]\s*/i, '')
    .replace(/^(le|la|les|un|une)\s+/i, '')
    .trim();
  const core = inner || pawn;
  const lowered =
    core.length <= 1
      ? core.toLowerCase()
      : `${core.charAt(0).toLowerCase()}${core.slice(1)}`;
  return `"${feminine ? 'sa' : 'son'} ${lowered}"`;
}
