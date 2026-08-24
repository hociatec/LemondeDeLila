import type { GameStateEntity } from '../../../../application/models/game-state.model';
import type { GameSingleActionDto } from '../../../../application/models/game-action.model';
import {
  isRollAlias,
  normalizeActionType,
} from '../../../../application/helpers/action-service.helper';
import { isStartedState } from '../../../../application/helpers/rulebook-guard.helper';
import {
  GameValidationError,
  PlayerActionError,
} from '../../../../domain/errors/public-api';
import {
  getPendingDrawActionsForPlayer,
  getPendingChooseTargetActionsForPlayer,
  validatePendingChooseTargetActionForActor,
  validatePendingDrawActionForActor,
} from '../../../../application/helpers/pending-actions-rulebook.helper';

const ALLOWED = new Set([
  'roll',
  'ROLL_DICE',
  'roll_dice',
  'draw',
  'answer_quiz',
  'choose_target',
]);

export function getAvailableActions(
  state: GameStateEntity,
  playerId: number,
): GameSingleActionDto[] {
  if (!isStartedState(state)) return [];

  const pending = state.pending;
  const drawActions = getPendingDrawActionsForPlayer(pending, playerId);
  if (drawActions.length > 0) return drawActions;
  if (pending?.type === 'quiz') {
    if ((pending.playerId ?? null) !== playerId) return [];
    return [{ type: 'answer_quiz', payload: {} }];
  }
  if (pending?.type === 'choose_target') {
    const chooseTargetActions = getPendingChooseTargetActionsForPlayer(
      pending,
      playerId,
    );
    if (chooseTargetActions.length > 0) return chooseTargetActions;
    return [];
  }

  if ((state.turn?.currentPlayerId ?? null) !== playerId) return [];
  return [{ type: 'roll', payload: {} }];
}

export function validateAction(
  state: GameStateEntity,
  action: GameSingleActionDto,
  actorId: number | null,
): GameSingleActionDto {
  const rawType = normalizeActionType(action);
  const normalized = rawType.toLowerCase();
  if (!ALLOWED.has(rawType) && !ALLOWED.has(normalized)) {
    throw new GameValidationError(
      `Action type not allowed: ${rawType || '(empty)'}`,
      {
        gameType: 'voyage-en-terre-de-brumes',
        action: rawType,
        allowedActions: Array.from(ALLOWED),
      },
    );
  }

  const pending = state.pending;
  if (pending?.type) {
    const pid = pending.playerId ?? null;
    if (pid != null && actorId != null && actorId !== pid) {
      throw new PlayerActionError("Ce n'est pas votre action.", {
        gameType: 'voyage-en-terre-de-brumes',
        playerId: actorId,
        currentPlayerId: pid,
      });
    }
    const drawValidation = validatePendingDrawActionForActor({
      pending,
      actorId: Number(actorId ?? NaN),
      actionType: normalized,
      samePlayer: (left, right) =>
        Number.isFinite(right) && Number(left) === Number(right),
    });
    if (drawValidation.ok) return drawValidation.action;
    if (
      pending.type === 'draw' &&
      drawValidation.reason === 'wrong_action_type'
    ) {
      throw new PlayerActionError('Action non disponible.', {
        gameType: 'voyage-en-terre-de-brumes',
        action: rawType,
      });
    }
    if (pending.type === 'quiz')
      return action.type === 'answer_quiz'
        ? action
        : { ...action, type: 'answer_quiz' };
    if (pending.type === 'choose_target') {
      const targetValidation = validatePendingChooseTargetActionForActor({
        pending,
        actorId: Number(actorId ?? NaN),
        actionType: normalized,
        payload: action.payload ?? {},
        samePlayer: (left, right) =>
          Number.isFinite(right) && Number(left) === Number(right),
      });
      if (targetValidation.ok) return targetValidation.action;
      if (targetValidation.reason === 'wrong_action_type') {
        throw new PlayerActionError('Action non disponible.', {
          gameType: 'voyage-en-terre-de-brumes',
          action: rawType,
        });
      }
      if (targetValidation.reason === 'invalid_target') {
        throw new GameValidationError('Cible invalide.', {
          gameType: 'voyage-en-terre-de-brumes',
          payload: action.payload ?? null,
        });
      }
    }
    throw new PlayerActionError('Action non disponible.', {
      gameType: 'voyage-en-terre-de-brumes',
      action: rawType,
    });
  }

  const current = state.turn?.currentPlayerId ?? null;
  if (current != null && actorId != null && actorId !== current) {
    throw new PlayerActionError("Ce n'est pas votre tour.", {
      gameType: 'voyage-en-terre-de-brumes',
      playerId: actorId,
      currentPlayerId: current,
    });
  }

  if (isRollAlias(rawType, normalized)) {
    return { ...action, type: 'roll', payload: {} };
  }
  if (normalized === 'draw') return { ...action, type: 'draw', payload: {} };
  if (normalized === 'answer_quiz') return action;
  if (normalized === 'choose_target') return action;
  return { ...action, type: 'roll', payload: {} };
}



