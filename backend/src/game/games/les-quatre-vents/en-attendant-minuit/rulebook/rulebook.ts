import type { GameSingleActionDto } from '../../../../core/application/models/game-action.model';
import type { GameStateEntity } from '../../../../core/application/models/game-state.model';
import {
  GameValidationError,
  PlayerActionError,
} from '../../../../core/domain/errors/public-api';
import {
  MINUIT_GAME,
  type MinuitActionType,
} from '../definitions/minuit.definition';
import type { MinuitMetadata } from '../model/minuit.types';
import {
  normalizeActionType,
  normalizeLegacyRollAliasToUpper,
} from '../../../../core/application/helpers/action-service.helper';
import {
  getPendingPawnActionsForPlayer,
  validatePendingPawnActionForActor,
} from '../../../../pawn-selection/public-api';
import {
  getPendingChooseTargetActionsForPlayer,
  getPendingDrawActionsForPlayer,
  validatePendingChooseTargetActionForActor,
  validatePendingDrawActionForActor,
} from '../../../../core/application/helpers/pending-actions-rulebook.helper';
import { toPlayerId } from '../../../../core/application/helpers/player-id.helper';
import { isStartedState } from '../../../../core/application/helpers/rulebook-guard.helper';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

function toText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

export function getAvailableActions(
  state: GameStateEntity,
  playerId: number,
): GameSingleActionDto[] {
  const status = String(state.status ?? '').toLowerCase();
  const pawnPending = state.pending;
  const pawnActions = getPendingPawnActionsForPlayer(
    pawnPending,
    playerId,
    'pick_pawn',
  );
  if (pawnActions.length > 0) {
    return pawnActions;
  }
  if (status !== 'started') return [];

  const meta = (state.metadata ?? {}) as MinuitMetadata;
  const pendingQuiz = meta.pendingQuiz ?? null;
  if (pendingQuiz) {
    if (toPlayerId(pendingQuiz.playerId) !== playerId) return [];
    return (pendingQuiz.choices ?? []).map((choice) => ({
      type: 'answer_quiz',
      payload: { answer: choice },
    }));
  }

  const activePending = state.pending;
  if (activePending) {
    const drawActions = getPendingDrawActionsForPlayer(
      activePending,
      playerId,
      {
        samePlayer: (left, right) => toPlayerId(left) === toPlayerId(right),
      },
    );
    if (drawActions.length > 0) return drawActions;
    const targetActions = getPendingChooseTargetActionsForPlayer(
      activePending,
      playerId,
      {
        samePlayer: (left, right) => toPlayerId(left) === toPlayerId(right),
      },
    );
    if (targetActions.length > 0) return targetActions;
    return [];
  }

  const current = toPlayerId(state.turn?.currentPlayerId ?? null);
  if (current !== playerId) return [];
  return [{ type: 'roll' }, { type: 'ROLL_DICE' }];
}

export function validateAction(
  state: GameStateEntity,
  action: GameSingleActionDto,
  actorId: number | null,
): GameSingleActionDto {
  const rawType = normalizeActionType(action);
  const type = normalizeLegacyRollAliasToUpper(rawType) as MinuitActionType;
  if (!MINUIT_GAME.actions.includes(type)) {
    throw new GameValidationError(`Action inconnue: ${rawType || '(vide)'}`, {
      gameType: 'en-attendant-minuit',
      action: rawType,
      allowedActions: MINUIT_GAME.actions,
    });
  }
  if (actorId == null) {
    throw new PlayerActionError('Acteur requis.', {
      gameType: 'en-attendant-minuit',
    });
  }

  const pickPawnPending = state.pending;
  if (pickPawnPending && pickPawnPending.type === 'pick_pawn') {
    const pawnValidation = validatePendingPawnActionForActor({
      pending: pickPawnPending,
      actorId,
      actionType: type,
      payload: action.payload ?? {},
      pendingType: 'pick_pawn',
    });
    if (!pawnValidation.ok && pawnValidation.reason === 'wrong_action_type') {
      throw new PlayerActionError('Action non disponible.', {
        gameType: 'en-attendant-minuit',
      });
    }
    if (!pawnValidation.ok && pawnValidation.reason === 'invalid_pawn') {
      throw new GameValidationError('Choix de pion invalide.', {
        gameType: 'en-attendant-minuit',
        pawn:
          asRecord(action.payload).pawn ??
          asRecord(action.payload).pawnId ??
          asRecord(action.payload).value ??
          null,
      });
    }
    if (!pawnValidation.ok) {
      throw new PlayerActionError("Ce n'est pas votre action.", {
        gameType: 'en-attendant-minuit',
      });
    }
    return pawnValidation.action;
  }

  if (!isStartedState(state)) {
    throw new PlayerActionError("La partie n'est pas démarrée.", {
      gameType: 'en-attendant-minuit',
    });
  }

  const meta = (state.metadata ?? {}) as MinuitMetadata;
  if (meta.pendingQuiz) {
    if (type !== 'answer_quiz') {
      throw new PlayerActionError('Action non disponible.', {
        gameType: 'en-attendant-minuit',
        action: type,
      });
    }
    if (toPlayerId(meta.pendingQuiz.playerId) !== actorId) {
      throw new PlayerActionError("Ce n'est pas votre action.", {
        gameType: 'en-attendant-minuit',
        expectedPlayerId: meta.pendingQuiz.playerId,
      });
    }
    const answer = toText(asRecord(action.payload).answer).trim();
    if (!answer) {
      throw new GameValidationError('Payload invalide: answer', {
        gameType: 'en-attendant-minuit',
        payload: action.payload,
      });
    }
    return { type: 'answer_quiz', payload: { answer } };
  }

  const actionPending = state.pending;
  if (actionPending) {
    const drawValidation = validatePendingDrawActionForActor({
      pending: actionPending,
      actorId,
      actionType: type,
      samePlayer: (left, right) => toPlayerId(left) === toPlayerId(right),
    });
    if (drawValidation.ok) {
      return drawValidation.action;
    }
    if (
      actionPending.type === 'draw' &&
      drawValidation.reason === 'wrong_action_type'
    ) {
      throw new PlayerActionError('Action non disponible.', {
        gameType: 'en-attendant-minuit',
        action: type,
      });
    }

    const targetValidation = validatePendingChooseTargetActionForActor({
      pending: actionPending,
      actorId,
      actionType: type,
      payload: action.payload ?? {},
      samePlayer: (left, right) => toPlayerId(left) === toPlayerId(right),
    });
    if (targetValidation.ok) {
      return targetValidation.action;
    }
    if (
      actionPending.type === 'choose_target' &&
      targetValidation.reason === 'wrong_action_type'
    ) {
      throw new PlayerActionError('Choix invalide.', {
        gameType: 'en-attendant-minuit',
      });
    }
    if (
      actionPending.type === 'choose_target' &&
      targetValidation.reason === 'invalid_target'
    ) {
      throw new GameValidationError('Cible invalide.', {
        gameType: 'en-attendant-minuit',
        targetPlayerId: targetValidation.targetPlayerId,
      });
    }

    if (toPlayerId(actionPending.playerId) !== actorId) {
      throw new PlayerActionError("Ce n'est pas votre action.", {
        gameType: 'en-attendant-minuit',
      });
    }
    throw new PlayerActionError('Action non disponible.', {
      gameType: 'en-attendant-minuit',
    });
  }

  const current = toPlayerId(state.turn?.currentPlayerId ?? null);
  if (current != null && actorId !== current) {
    throw new PlayerActionError("Ce n'est pas votre tour.", {
      gameType: 'en-attendant-minuit',
      playerId: actorId,
      currentPlayerId: current,
    });
  }

  if (type === 'ROLL_DICE') return { type: 'roll', payload: {} };
  return { type, payload: action.payload ?? {} };
}



