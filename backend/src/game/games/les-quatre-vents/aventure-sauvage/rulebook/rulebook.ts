import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import { resolvePawnId } from '../aventure-sauvage.pawns';
import { normalizeActionType, normalizeLowerActionType } from '../../../../actions/action-service.helper';
import { isStartedState } from '../../../../rulebook/rulebook-guard.helper';

function samePlayerId(a: unknown, b: unknown): boolean {
  const left = Number(a);
  const right = Number(b);
  return Number.isFinite(left) && Number.isFinite(right) && left === right;
}

export function getAvailableActions(
  state: GameStateEntity,
  playerId: number,
): GameSingleActionDto[] {
  if (!isStartedState(state)) return [];
  const pending = state.pending as any;
  if (pending) {
    if (pending.type === 'draw' && samePlayerId(pending.playerId, playerId)) {
      return [{ type: 'draw', payload: {} }];
    }
    if (
      pending.type === 'choose_pawn' &&
      samePlayerId(pending.playerId, playerId)
    ) {
      const pawns: Array<{ id?: string }> = Array.isArray(pending?.data?.pawns)
        ? pending.data.pawns
        : [];
      return pawns
        .map((p) => String(p?.id ?? '').trim())
        .filter((id) => id.length > 0)
        .map((id) => ({ type: 'choose_pawn', payload: { pawnId: id } }));
    }
    return [];
  }
  const current = state.turn?.currentPlayerId ?? null;
  if (!samePlayerId(current, playerId)) return [];
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
    type !== 'draw' &&
    type !== 'choose_pawn'
  ) {
    throw new Error(`Action inconnue: ${type}`);
  }
  if (actorId == null) {
    throw new Error('Acteur requis');
  }
  const status = String(state.status ?? '').toLowerCase();
  if (status !== 'started') {
    throw new Error("La partie n'est pas demarree.");
  }
  const pending = state.pending as any;
  if (pending) {
    if (pending.type === 'draw' && samePlayerId(pending.playerId, actorId)) {
      if (type !== 'draw') {
        throw new Error('Action indisponible (pioche requise).');
      }
      return { type: 'draw', payload: {} };
    }
    if (
      pending.type === 'choose_pawn' &&
      samePlayerId(pending.playerId, actorId)
    ) {
      if (type !== 'choose_pawn') {
        throw new Error('Action indisponible (choix de pion requis).');
      }
      const payload = (action.payload ?? {}) as any;
      const rawPawn = payload.pawnId ?? payload.pawn ?? payload.value ?? null;
      const resolved = resolvePawnId(rawPawn);
      const pawns: Array<{ id?: string }> = Array.isArray(pending?.data?.pawns)
        ? pending.data.pawns
        : [];
      const chosen =
        resolved != null
          ? pawns.find((p) => resolvePawnId(p?.id) === resolved)
          : null;
      if (!chosen) {
        throw new Error('Pion invalide.');
      }
      return { type: 'choose_pawn', payload: { pawnId: chosen.id } };
    }
    throw new Error('Action indisponible (choix en attente).');
  }
  const current = state.turn?.currentPlayerId ?? null;
  if (!samePlayerId(current, actorId)) {
    throw new Error("Ce n'est pas votre tour.");
  }
  return { type: 'roll', payload: {} };
}



