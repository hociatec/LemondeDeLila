import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import { normalizeActionType, normalizeLowerActionType } from '../../../../actions/action-service.helper';
import { isStartedState } from '../../../../rulebook/rulebook-guard.helper';

export function getAvailableActions(
  state: GameStateEntity,
  playerId: number,
): GameSingleActionDto[] {
  if (!isStartedState(state)) return [];

  const pending = state.pending as any;
  if (pending) {
    if (pending.type === 'draw' && pending.playerId === playerId) {
      return [{ type: 'draw', payload: {} }];
    }
    if (pending.type === 'choose_pawn' && pending.playerId === playerId) {
      const pawns: Array<{ id?: string }> = Array.isArray(pending?.data?.pawns)
        ? pending.data.pawns
        : [];
      return pawns
        .map((p) => String(p?.id ?? '').trim())
        .filter((id) => id.length > 0)
        .map((id) => ({ type: 'choose_pawn', payload: { pawnId: id } }));
    }
    if (pending.type === 'swap' && pending.playerId === playerId) {
      const targets: Array<{ targetPlayerId: number }> = Array.isArray(
        pending?.data?.targets,
      )
        ? pending.data.targets
        : [];
      return targets.map((t) => ({
        type: 'swap_choose_target',
        payload: { targetPlayerId: t.targetPlayerId },
      }));
    }
    return [];
  }

  const current = state.turn?.currentPlayerId ?? null;
  if (current !== playerId) return [];
  return [{ type: 'roll', payload: {} }];
}

export function validateAction(
  state: GameStateEntity,
  action: GameSingleActionDto,
  actorId: number | null,
): GameSingleActionDto {
  const type = normalizeActionType(action);
  if (
    type !== 'roll' &&
    type !== 'ROLL_DICE' &&
    type !== 'roll_dice' &&
    type !== 'choose_pawn' &&
    type !== 'swap_choose_target' &&
    type !== 'draw'
  ) {
    throw new Error(`Action inconnue: ${type}`);
  }
  if (actorId == null) {
    throw new Error('Acteur requis');
  }
  const status = String(state.status ?? '').toLowerCase();
  if (status !== 'started') {
    throw new Error("La partie n'est pas démarrée.");
  }

  const current = state.turn?.currentPlayerId ?? null;

  if (type === 'draw') {
    const pending = state.pending as any;
    if (!pending || pending.type !== 'draw' || pending.playerId !== actorId) {
      throw new Error('Aucune pioche en attente.');
    }
    return { type: 'draw', payload: {} };
  }
  if (type === 'choose_pawn') {
    const pending = state.pending as any;
    if (!pending || pending.type !== 'choose_pawn' || pending.playerId !== actorId) {
      throw new Error('Aucun choix de pion en attente.');
    }
    const payload = (action.payload ?? {}) as any;
    const rawPawn = payload.pawnId ?? payload.pawn ?? payload.value ?? null;
    const pawns: Array<{ id?: string }> = Array.isArray(pending?.data?.pawns)
      ? pending.data.pawns
      : [];
    const chosen =
      rawPawn != null
        ? pawns.find((p) => String(p?.id ?? '').trim() === String(rawPawn).trim())
        : null;
    if (!chosen) {
      throw new Error('Pion invalide.');
    }
    return { type: 'choose_pawn', payload: { pawnId: chosen.id } };
  }

  if (type === 'swap_choose_target') {
    const pending = state.pending as any;
    if (!pending || pending.type !== 'swap' || pending.playerId !== actorId) {
      throw new Error('Aucun échange de position en attente.');
    }
    const targets: Array<{ targetPlayerId: number }> = Array.isArray(
      pending?.data?.targets,
    )
      ? pending.data.targets
      : [];
    const payload = (action?.payload ?? {}) as any;
    const targetPlayerId =
      typeof payload.targetPlayerId === 'number'
        ? payload.targetPlayerId
        : Number(payload.targetPlayerId);
    if (!Number.isFinite(targetPlayerId)) {
      throw new Error('Cible invalide.');
    }
    if (!targets.some((t) => t.targetPlayerId === targetPlayerId)) {
      throw new Error('Cible invalide.');
    }
    return { type: 'swap_choose_target', payload: { targetPlayerId } };
  }

  if (state.pending) {
    throw new Error('Action indisponible (choix en attente).');
  }
  if (current !== actorId) {
    throw new Error("Ce n'est pas votre tour.");
  }
  return { type: 'roll', payload: {} };
}




