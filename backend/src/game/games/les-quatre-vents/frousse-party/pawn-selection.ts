import type { PendingState } from '../../../application/models/game-state.model';
import type { FrousseMetadata } from './model/frousse.types';
import { formatPawnChoiceLabel, resolvePawnId } from './pawns.utils';

type PlayerLike = { id?: number; pawn?: unknown } | null | undefined;

export function buildPawnSelectionPending(
  players: PlayerLike[],
  meta: FrousseMetadata,
): PendingState | null {
  const cleaned = (players ?? []).filter(
    (p): p is { id: number; pawn?: unknown } =>
      Boolean(p && typeof p.id === 'number'),
  );
  if (!cleaned.length) return null;

  const assigned = new Set<string>(
    cleaned
      .map((p) => resolvePawnId(p.pawn))
      .filter((id): id is string => Boolean(id)),
  );

  const candidates = availablePawns(meta, assigned);
  if (!candidates.length) return null;

  const nextPlayer = cleaned.find((p) => !resolvePawnId(p.pawn));
  if (!nextPlayer) return null;

  return {
    type: 'choose_pawn',
    playerId: nextPlayer.id,
    blocking: true,
    choices: candidates.map((pawn) => formatPawnChoiceLabel(pawn)),
    data: {
      kind: 'choose_pawn',
      pawns: candidates,
    },
  };
}

function availablePawns(meta: FrousseMetadata, assigned: Set<string>) {
  const list = Array.isArray(meta?.pawns) ? meta.pawns : [];
  return list.filter((pawn) => {
    const id = resolvePawnId(pawn?.id);
    return id != null && !assigned.has(id);
  });
}


