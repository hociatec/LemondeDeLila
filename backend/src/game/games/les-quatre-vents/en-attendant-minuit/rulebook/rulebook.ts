import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import {
  GameValidationError,
  PlayerActionError,
} from '../../../../../common/errors/game-errors';
import {
  MINUIT_GAME,
  type MinuitActionType,
} from '../definitions/minuit.definition';
import type { MinuitMetadata } from '../model/minuit.types';
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
  const status = String(state.status ?? '').toLowerCase();
  const pawnPending = state.pending as any;
  const pawnActions = getPendingPawnActionsForPlayer(
    pawnPending,
    playerId,
    'pick_pawn',
  );
  if (pawnActions.length > 0) {
    return pawnActions;
  }
  if (status !== 'started') return [];

  const meta = (state.metadata ?? {}) as any as MinuitMetadata;
  const pendingQuiz = meta.pendingQuiz ?? null;
  if (pendingQuiz) {
    if (toPlayerId(pendingQuiz.playerId) !== playerId) return [];
    return (pendingQuiz.choices ?? []).map((choice) => ({
      type: 'answer_quiz',
      payload: { answer: choice },
    }));
  }

  const activePending = state.pending as any;
  if (activePending) {
    const drawActions = getPendingDrawActionsForPlayer(activePending, playerId, {
      samePlayer: (left, right) => toPlayerId(left) === toPlayerId(right),
    });
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

  const pickPawnPending = state.pending as any;
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
          (action.payload as any)?.pawn ??
          (action.payload as any)?.pawnId ??
          (action.payload as any)?.value ??
          null,
      });
    }
    if (!pawnValidation.ok) {
      throw new PlayerActionError("Ce n'est pas votre action.", {
        gameType: 'en-attendant-minuit',
      });
    }
    return pawnValidation.action as GameSingleActionDto;
  }

  if (!isStartedState(state)) {
    throw new PlayerActionError("La partie n'est pas démarrée.", {
      gameType: 'en-attendant-minuit',
    });
  }

  const meta = (state.metadata ?? {}) as any as MinuitMetadata;
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
    const answer = String((action.payload as any)?.answer ?? '').trim();
    if (!answer) {
      throw new GameValidationError('Payload invalide: answer', {
        gameType: 'en-attendant-minuit',
        payload: action.payload,
      });
    }
    return { type: 'answer_quiz', payload: { answer } };
  }

  const actionPending = state.pending as any;
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



