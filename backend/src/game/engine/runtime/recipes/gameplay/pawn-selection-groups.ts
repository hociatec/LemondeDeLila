import type { GameContext } from '../../definitions/game-author-context';
import {
  GameConfigurationError,
  GameRuleViolationError,
} from '../../../../core/domain/errors/game-domain.errors';

export type PawnSelectionGroup = {
  readonly id: string;
  readonly label: string;
  readonly pawnIds: readonly string[];
};

export function validatePawnSelectionGroups(
  groups: readonly PawnSelectionGroup[],
): readonly PawnSelectionGroup[] {
  const ids = new Set<string>();
  const pawns = new Set<string>();
  if (!groups.length || groups.length > 512)
    throw new GameConfigurationError('Invalid pawn selection groups');
  for (const group of groups) {
    if (
      !group.id.trim() ||
      group.id.length > 128 ||
      ids.has(group.id) ||
      !group.pawnIds.length
    )
      throw new GameConfigurationError('Invalid pawn selection group');
    ids.add(group.id);
    for (const id of group.pawnIds) {
      if (!id.trim() || pawns.has(id))
        throw new GameConfigurationError('Duplicate or empty grouped pawn');
      pawns.add(id);
    }
  }
  return Object.freeze(
    groups.map((group) =>
      Object.freeze({ ...group, pawnIds: Object.freeze([...group.pawnIds]) }),
    ),
  );
}

export function assignPawnSelection<TState extends object>(
  setId: string,
  choice: string,
  playerId: number,
  ctx: GameContext<TState>,
  groups?: readonly PawnSelectionGroup[],
): void {
  if (!groups) {
    ctx.pawns.assign(setId, playerId, choice);
    return;
  }
  const group = groups.find((entry) => entry.id === choice);
  const available = new Set(ctx.pawns.available(setId).map((pawn) => pawn.id));
  if (
    !group ||
    group.pawnIds.some((id) => !available.has(id)) ||
    group.pawnIds.length + ctx.pawns.assigned(setId, playerId).length >
      ctx.pawns.perPlayer(setId)
  )
    throw new GameRuleViolationError('PAWN_SELECTION_GROUP_UNAVAILABLE');
  for (const id of group.pawnIds) ctx.pawns.assign(setId, playerId, id);
}
