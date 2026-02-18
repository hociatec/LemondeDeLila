import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import {
  FOULEES_FANTASTIQUES_GAME,
  type FouleesFantastiquesActionType,
} from '../definitions/game.definition';
import {
  GameValidationError,
  PlayerActionError,
} from '../../../../../common/errors/game-errors';
import type { FouleesFantastiquesMetadata } from '../model/foulees-fantastiques-state.entity';
import { isRollAlias, normalizeActionType, normalizeLowerActionType } from '../../../../actions/action-service.helper';
import {
  isPendingPawnMoveForPlayer,
  listPendingPawnMoveActions,
  resolvePendingPawnMove,
} from '../../../../core/helpers/pawn-move-selection.helper';

export function getAvailableActions(
  state: GameStateEntity,
  playerId: number,
): GameSingleActionDto[] {
  if ((state.status || '').toLowerCase() !== 'started') return [];

  const current = state.turn?.currentPlayerId ?? null;
  if (current !== playerId) return [];

  const pending: any = state.pending ?? null;
  if (pending) {
    if (pending.type === 'choose_family' && pending.playerId === playerId) {
      const familyIds: string[] = Array.isArray(pending?.data?.familyIds)
        ? pending.data.familyIds
        : [];
      return familyIds
        .filter((id) => typeof id === 'string' && id.trim().length > 0)
        .map((id) => ({
          type: 'choose_family',
          payload: { familyId: String(id).trim() },
        }));
    }
    if (isPendingPawnMoveForPlayer(pending, playerId, 'choose_pawn')) {
      return listPendingPawnMoveActions(pending, 'move_pawn');
    }
    return [];
  }

  return [{ type: 'roll' }, { type: 'ROLL_DICE' }];
}

export function validateAction(
  state: GameStateEntity,
  action: GameSingleActionDto,
  actorId: number | null,
): GameSingleActionDto {
  const rawType = normalizeActionType(action);
  const normalizedType = rawType.toLowerCase();
  const type = rawType as FouleesFantastiquesActionType;
  if (
    !FOULEES_FANTASTIQUES_GAME.actions.includes(type) &&
    !FOULEES_FANTASTIQUES_GAME.actions.includes(normalizedType as any)
  ) {
    throw new GameValidationError(`Action inconnue: ${rawType}`, {
      gameType: 'foulees-fantastiques',
      action: rawType,
      allowedActions: FOULEES_FANTASTIQUES_GAME.actions,
    });
  }

  const current = state.turn?.currentPlayerId ?? null;
  if (current != null && actorId != null && actorId !== current) {
    throw new PlayerActionError("Ce n'est pas votre tour.", {
      gameType: 'foulees-fantastiques',
      playerId: actorId,
      currentPlayerId: current,
    });
  }

  if (isRollAlias(type, normalizedType)) {
    return { ...action, type: 'roll', payload: {} };
  }

  if (type === 'roll') {
    return { ...action, type: 'roll', payload: {} };
  }

  if (type === 'choose_family') {
    const pending: any = state.pending ?? null;
    if (
      !pending ||
      pending.type !== 'choose_family' ||
      pending.playerId !== actorId
    ) {
      throw new PlayerActionError('Aucun choix de famille en attente.', {
        gameType: 'foulees-fantastiques',
        playerId: actorId ?? undefined,
      });
    }
    const payload = action.payload ?? {};
    const familyId = String((payload as any).familyId ?? '').trim();
    if (!familyId) {
      throw new GameValidationError('Payload invalide: familyId', {
        gameType: 'foulees-fantastiques',
        playerId: actorId ?? undefined,
        payload,
      });
    }
    const allowed: string[] = Array.isArray(pending?.data?.familyIds)
      ? pending.data.familyIds
      : [];
    const ok = allowed.some(
      (id) => typeof id === 'string' && id.trim() === familyId,
    );
    if (!ok) {
      throw new GameValidationError('Famille invalide.', {
        gameType: 'foulees-fantastiques',
        playerId: actorId ?? undefined,
        payload,
      });
    }

    const meta = (state.metadata ?? {}) as any as FouleesFantastiquesMetadata;
    const taken = Object.entries(meta.familyIdByPlayer ?? {}).some(
      ([pid, fid]) =>
        Number(pid) !== (actorId ?? NaN) &&
        String(fid ?? '').trim() === familyId,
    );
    if (taken) {
      throw new GameValidationError('Famille déjà choisie.', {
        gameType: 'foulees-fantastiques',
        playerId: actorId ?? undefined,
        payload,
      });
    }
    return { ...action, type: 'choose_family', payload: { familyId } };
  }

  if (type === 'move_pawn') {
    const pending: any = state.pending ?? null;
    if (
      !isPendingPawnMoveForPlayer(pending, actorId, 'choose_pawn')
    ) {
      throw new PlayerActionError('Aucun choix de pion en attente.', {
        gameType: 'foulees-fantastiques',
        playerId: actorId ?? undefined,
      });
    }

    const move = resolvePendingPawnMove(pending, action.payload ?? {});
    if (!move) {
      throw new GameValidationError(
        'Payload invalide: pawnIndex/targetProgress',
        {
          gameType: 'foulees-fantastiques',
          playerId: actorId ?? undefined,
          payload: action.payload,
        },
      );
    }

    return {
      ...action,
      type: 'move_pawn',
      payload: move,
    };
  }

  return { ...action, type: 'roll', payload: {} };
}

