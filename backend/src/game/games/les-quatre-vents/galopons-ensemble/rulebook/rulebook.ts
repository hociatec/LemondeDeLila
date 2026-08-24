import type { GameSingleActionDto } from '../../../../models/game-action.model';
import type { GameStateEntity } from '../../../../application/models/game-state.model';
import {
  normalizeActionType,
  normalizeLegacyRollAliasToUpper,
} from '../../../../application/helpers/action-service.helper';
import { isStartedState } from '../../../../application/helpers/rulebook-guard.helper';
import {
  GameValidationError,
  PlayerActionError,
} from '../../../../domain/errors/public-api';
import {
  GALOPONS_GAME,
  type GaloponsActionType,
} from '../definitions/galopons.definition';
import {
  getPendingPawnActionsForPlayer,
  validatePendingPawnActionForActor,
} from '../../../../application/helpers/pawn-pending-rulebook.helper';
import {
  getPendingChooseTargetActionsForPlayer,
  getPendingDrawActionsForPlayer,
  validatePendingChooseTargetActionForActor,
  validatePendingDrawActionForActor,
} from '../../../../application/helpers/pending-actions-rulebook.helper';

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

export function getAvailableActions(
  state: GameStateEntity,
  playerId: number,
): GameSingleActionDto[] {
  if (!isStartedState(state)) return [];

  const pending = state.pending;
  if (pending) {
    const drawActions = getPendingDrawActionsForPlayer(pending, playerId);
    if (drawActions.length > 0) return drawActions;
    const pawnActions = getPendingPawnActionsForPlayer(
      pending,
      playerId,
      'choose_pawn',
    );
    if (pawnActions.length > 0) return pawnActions;
    const targetActions = getPendingChooseTargetActionsForPlayer(
      pending,
      playerId,
    );
    if (targetActions.length > 0) return targetActions;
    return [];
  }

  const current = state.turn?.currentPlayerId ?? null;
  if (current !== playerId) return [];
  return [{ type: 'roll' }];
}

export function validateAction(
  state: GameStateEntity,
  action: GameSingleActionDto,
  actorId: number | null,
): GameSingleActionDto {
  const rawType = normalizeActionType(action);
  const type = normalizeLegacyRollAliasToUpper(rawType) as GaloponsActionType;
  if (!GALOPONS_GAME.actions.includes(type)) {
    throw new GameValidationError(`Action inconnue: ${rawType || '(vide)'}`, {
      gameType: 'galopons-ensemble',
      action: rawType,
      allowedActions: GALOPONS_GAME.actions,
    });
  }
  if (actorId == null)
    throw new PlayerActionError('Acteur requis.', {
      gameType: 'galopons-ensemble',
    });

  if (!isStartedState(state)) {
    throw new PlayerActionError("La partie n'est pas dÃƒÂ©marrÃƒÂ©e.", {
      gameType: 'galopons-ensemble',
    });
  }

  const pending = state.pending;
  if (pending) {
    const drawValidation = validatePendingDrawActionForActor({
      pending,
      actorId,
      actionType: type,
    });
    if (drawValidation.ok) {
      return drawValidation.action;
    }
    const pendingRow = asRecord(pending);
    if (
      pendingRow.type === 'draw' &&
      drawValidation.reason === 'wrong_action_type'
    ) {
      throw new PlayerActionError('Action non disponible.', {
        gameType: 'galopons-ensemble',
      });
    }

    if (pendingRow.type === 'choose_pawn') {
      const pawnValidation = validatePendingPawnActionForActor({
        pending,
        actorId,
        actionType: type,
        payload: action.payload ?? {},
        pendingType: 'choose_pawn',
      });
      if (!pawnValidation.ok && pawnValidation.reason === 'wrong_action_type') {
        throw new PlayerActionError('Choix invalide.', {
          gameType: 'galopons-ensemble',
        });
      }
      if (!pawnValidation.ok && pawnValidation.reason === 'invalid_pawn') {
        throw new GameValidationError('Pion invalide.', {
          gameType: 'galopons-ensemble',
          pawnId:
            asRecord(action.payload).pawnId ??
            asRecord(action.payload).pawn ??
            asRecord(action.payload).value ??
            null,
        });
      }
      if (!pawnValidation.ok) {
        throw new PlayerActionError('Choix invalide.', {
          gameType: 'galopons-ensemble',
        });
      }
      return pawnValidation.action;
    }

    const targetValidation = validatePendingChooseTargetActionForActor({
      pending,
      actorId,
      actionType: type,
      payload: action.payload ?? {},
    });
    if (targetValidation.ok) {
      return targetValidation.action;
    }
    if (
      pendingRow.type === 'choose_target' &&
      targetValidation.reason === 'wrong_action_type'
    ) {
      throw new PlayerActionError('Choix invalide.', {
        gameType: 'galopons-ensemble',
      });
    }
    if (
      pendingRow.type === 'choose_target' &&
      targetValidation.reason === 'invalid_target'
    ) {
      throw new GameValidationError('Cible invalide.', {
        gameType: 'galopons-ensemble',
        targetPlayerId: targetValidation.targetPlayerId,
      });
    }

    if (Number(pendingRow.playerId ?? null) !== actorId) {
      throw new PlayerActionError("Ce n'est pas votre action.", {
        gameType: 'galopons-ensemble',
      });
    }
    throw new PlayerActionError('Action non disponible.', {
      gameType: 'galopons-ensemble',
    });
  }

  const current = state.turn?.currentPlayerId ?? null;
  if (current != null && actorId !== current) {
    throw new PlayerActionError("Ce n'est pas votre tour.", {
      gameType: 'galopons-ensemble',
      playerId: actorId,
      currentPlayerId: current,
    });
  }

  if (type === 'ROLL_DICE') return { type: 'roll', payload: {} };
  return { type, payload: action.payload ?? {} };
}



