import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import {
  GameValidationError,
  PlayerActionError,
} from '../../../../../common/errors/game-errors';
import {
  FROUSSE_GAME,
  type FrousseActionType,
} from '../definitions/frousse.definition';
import { resolvePawnId } from '../pawns.utils';
import {
  normalizeActionType,
  normalizeLegacyRollAliasToUpper,
  normalizeLowerActionType,
} from '../../../../actions/action-service.helper';
import {
  getPendingPawnActionsForPlayer,
  validatePendingPawnActionForActor,
} from '../../../../core/helpers/pawn-pending-rulebook.helper';
import {
  getPendingChooseTargetActionsForPlayer,
  getPendingDrawActionsForPlayer,
  validatePendingChooseTargetActionForActor,
  validatePendingDrawActionForActor,
} from '../../../../core/helpers/pending-actions-rulebook.helper';
import { toPlayerId } from '../../../../core/helpers/player-id.helper';
import { isStartedState } from '../../../../rulebook/rulebook-guard.helper';

export function getAvailableActions(
  state: GameStateEntity,
  playerId: number,
): GameSingleActionDto[] {
  if (!isStartedState(state)) return [];

  const pending = state.pending as any;
  if (pending) {
    const drawActions = getPendingDrawActionsForPlayer(pending, playerId, {
      samePlayer: (left, right) => toPlayerId(left) === toPlayerId(right),
    });
    if (drawActions.length > 0) return drawActions;
    const pawnActions = getPendingPawnActionsForPlayer(
      pending,
      playerId,
      'choose_pawn',
    );
    if (pawnActions.length > 0) {
      return pawnActions;
    }
    const targetActions = getPendingChooseTargetActionsForPlayer(
      pending,
      playerId,
      {
        samePlayer: (left, right) => toPlayerId(left) === toPlayerId(right),
      },
    );
    if (targetActions.length > 0) return targetActions;
    return [];
  }

  const current = toPlayerId(state.turn?.currentPlayerId ?? null);
  if (current == null || current !== playerId) return [];
  return [{ type: 'roll' }, { type: 'ROLL_DICE' }];
}

export function validateAction(
  state: GameStateEntity,
  action: GameSingleActionDto,
  actorId: number | null,
): GameSingleActionDto {
  const rawType = normalizeActionType(action);
  const type = normalizeLegacyRollAliasToUpper(rawType) as FrousseActionType;
  if (!FROUSSE_GAME.actions.includes(type)) {
    throw new GameValidationError(`Action inconnue: ${rawType || '(vide)'}`, {
      gameType: 'frousse-party',
      action: rawType,
      allowedActions: FROUSSE_GAME.actions,
    });
  }
  if (actorId == null)
    throw new PlayerActionError('Acteur requis.', {
      gameType: 'frousse-party',
    });
  if (!isStartedState(state)) {
    throw new PlayerActionError("La partie n'est pas démarrée.", {
      gameType: 'frousse-party',
    });
  }

  const pending = state.pending as any;
  if (pending) {
    const drawValidation = validatePendingDrawActionForActor({
      pending,
      actorId,
      actionType: type,
      samePlayer: (left, right) => toPlayerId(left) === toPlayerId(right),
    });
    if (drawValidation.ok) {
      return drawValidation.action;
    }
    if (pending.type === 'draw' && drawValidation.reason === 'wrong_action_type') {
      throw new PlayerActionError('Action non disponible.', {
        gameType: 'frousse-party',
      });
    }

    if (pending.type === 'choose_pawn') {
      const pawnValidation = validatePendingPawnActionForActor({
        pending,
        actorId,
        actionType: type,
        payload: action.payload ?? {},
        pendingType: 'choose_pawn',
        idResolver: (value) => String(resolvePawnId(value) ?? '').trim(),
      });
      if (!pawnValidation.ok && pawnValidation.reason === 'wrong_action_type') {
        throw new PlayerActionError('Choix invalide.', {
          gameType: 'frousse-party',
        });
      }
      if (!pawnValidation.ok && pawnValidation.reason === 'invalid_pawn') {
        throw new GameValidationError('Pion invalide.', {
          gameType: 'frousse-party',
          pawnId:
            (action.payload as any)?.pawnId ??
            (action.payload as any)?.pawn ??
            (action.payload as any)?.value ??
            null,
        });
      }
      if (!pawnValidation.ok) {
        throw new PlayerActionError('Choix invalide.', {
          gameType: 'frousse-party',
        });
      }
      return pawnValidation.action;
    }
    const targetValidation = validatePendingChooseTargetActionForActor({
      pending,
      actorId,
      actionType: type,
      payload: action.payload ?? {},
      samePlayer: (left, right) => toPlayerId(left) === toPlayerId(right),
    });
    if (targetValidation.ok) {
      return targetValidation.action;
    }
    if (
      pending.type === 'choose_target' &&
      targetValidation.reason === 'wrong_action_type'
    ) {
      throw new PlayerActionError('Choix invalide.', {
        gameType: 'frousse-party',
      });
    }
    if (
      pending.type === 'choose_target' &&
      targetValidation.reason === 'invalid_target'
    ) {
      throw new GameValidationError('Cible invalide.', {
        gameType: 'frousse-party',
        targetPlayerId: targetValidation.targetPlayerId,
      });
    }

    const pendingPlayerId = toPlayerId(pending.playerId);
    if (pendingPlayerId == null || pendingPlayerId !== actorId) {
      throw new PlayerActionError("Ce n'est pas votre action.", {
        gameType: 'frousse-party',
      });
    }
    throw new PlayerActionError('Action non disponible.', {
      gameType: 'frousse-party',
    });
  }

  const current = toPlayerId(state.turn?.currentPlayerId ?? null);
  if (current != null && actorId !== current) {
    throw new PlayerActionError("Ce n'est pas votre tour.", {
      gameType: 'frousse-party',
      playerId: actorId,
      currentPlayerId: current,
    });
  }

  if (type === 'ROLL_DICE') return { type: 'roll', payload: {} };
  return { type, payload: action.payload ?? {} };
}




