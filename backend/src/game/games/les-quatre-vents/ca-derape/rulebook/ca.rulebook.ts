import type { GameStateEntity } from '../../../../application/models/game-state.model';
import type { GameSingleActionDto } from '../../../../models/game-action.model';
import {
  isRollActionType,
  normalizeActionType,
  normalizeLegacyRollAliasToUpper,
} from '../../../../application/helpers/action-service.helper';
import { isStartedState } from '../../../../application/helpers/rulebook-guard.helper';
import {
  GameValidationError,
  PlayerActionError,
} from '../../../../domain/errors/public-api';
import {
  CA_DERAPE_GAME,
  type CaDerapeActionType,
} from '../definitions/ca.definition';
import {
  getPendingChooseTargetActionsForPlayer,
  getPendingDrawActionsForPlayer,
  getPendingNumberSetChoiceActionsForPlayer,
  validatePendingChooseTargetActionForActor,
  validatePendingDrawActionForActor,
  validatePendingNumberSetChoiceActionForActor,
} from '../../../../application/helpers/pending-actions-rulebook.helper';

export function getAvailableActions(
  state: GameStateEntity,
  playerId: number,
): GameSingleActionDto[] {
  if (!isStartedState(state)) return [];

  const pending = state.pending;
  if (pending) {
    const drawActions = getPendingDrawActionsForPlayer(pending, playerId);
    if (drawActions.length > 0) return drawActions;
    const targetActions = getPendingChooseTargetActionsForPlayer(
      pending,
      playerId,
    );
    if (targetActions.length > 0) return targetActions;
    if (pending.type === 'choose_next_player') {
      return getPendingNumberSetChoiceActionsForPlayer(pending, playerId, {
        pendingType: 'choose_next_player',
        actionType: 'choose_next_player',
        payloadValueKey: 'playerId',
        valuesKey: 'playerIds',
      });
    }
    if (pending.type === 'choose_next_delta') {
      return getPendingNumberSetChoiceActionsForPlayer(pending, playerId, {
        pendingType: 'choose_next_delta',
        actionType: 'choose_next_delta',
        payloadValueKey: 'delta',
        valuesKey: 'deltas',
      });
    }
    return [];
  }

  const current = state.turn?.currentPlayerId ?? null;
  if (current !== playerId) return [];
  return [
    { type: 'roll', payload: {} },
    { type: 'ROLL_DICE', payload: {} },
  ];
}

export function validateAction(
  state: GameStateEntity,
  action: GameSingleActionDto,
  actorId: number | null,
): GameSingleActionDto {
  const rawType = normalizeActionType(action);
  const normalized = normalizeLegacyRollAliasToUpper(
    rawType,
  ) as CaDerapeActionType;

  if (!CA_DERAPE_GAME.actions.includes(normalized)) {
    throw new GameValidationError(`Action inconnue: ${rawType || '(vide)'}`, {
      gameType: 'ca-derape',
      action: rawType,
      allowedActions: CA_DERAPE_GAME.actions,
    });
  }
  if (actorId == null) {
    throw new PlayerActionError('Acteur requis.', { gameType: 'ca-derape' });
  }

  const status = String(state.status ?? '').toLowerCase();
  if (status !== 'started') {
    throw new PlayerActionError("La partie n'est pas dÃƒÂ©marrÃƒÂ©e.", {
      gameType: 'ca-derape',
    });
  }

  const pending = state.pending;
  if (pending) {
    const drawValidation = validatePendingDrawActionForActor({
      pending,
      actorId,
      actionType: normalized,
    });
    if (drawValidation.ok) {
      return drawValidation.action;
    }
    if (
      pending.type === 'draw' &&
      drawValidation.reason === 'wrong_action_type'
    ) {
      throw new PlayerActionError('Action non disponible.', {
        gameType: 'ca-derape',
      });
    }

    const targetValidation = validatePendingChooseTargetActionForActor({
      pending,
      actorId,
      actionType: normalized,
      payload: action.payload ?? {},
    });
    if (targetValidation.ok) {
      return targetValidation.action;
    }
    if (
      pending.type === 'choose_target' &&
      targetValidation.reason === 'wrong_action_type'
    ) {
      throw new PlayerActionError('Choix invalide.', {
        gameType: 'ca-derape',
      });
    }
    if (
      pending.type === 'choose_target' &&
      targetValidation.reason === 'invalid_target'
    ) {
      throw new GameValidationError('Cible invalide.', {
        gameType: 'ca-derape',
        targetPlayerId: targetValidation.targetPlayerId,
      });
    }

    if (pending.playerId !== actorId) {
      throw new PlayerActionError('Action rÃƒÂ©servÃƒÂ©e ÃƒÂ  un autre joueur.', {
        gameType: 'ca-derape',
      });
    }
    if (pending.type === 'choose_next_player') {
      const playerValidation = validatePendingNumberSetChoiceActionForActor({
        pending,
        actorId,
        actionType: normalized,
        payload: action.payload ?? {},
        pendingType: 'choose_next_player',
        expectedActionType: 'choose_next_player',
        payloadValueKey: 'playerId',
        valuesKey: 'playerIds',
      });
      if (
        !playerValidation.ok &&
        playerValidation.reason === 'wrong_action_type'
      ) {
        throw new PlayerActionError('Choix invalide.', {
          gameType: 'ca-derape',
        });
      }
      if (!playerValidation.ok) {
        const payload = asRecord(action.payload);
        throw new GameValidationError('Joueur invalide.', {
          gameType: 'ca-derape',
          playerId: toNumber(payload.playerId),
        });
      }
      return playerValidation.action;
    }
    if (pending.type === 'choose_next_delta') {
      const deltaValidation = validatePendingNumberSetChoiceActionForActor({
        pending,
        actorId,
        actionType: normalized,
        payload: action.payload ?? {},
        pendingType: 'choose_next_delta',
        expectedActionType: 'choose_next_delta',
        payloadValueKey: 'delta',
        valuesKey: 'deltas',
      });
      if (
        !deltaValidation.ok &&
        deltaValidation.reason === 'wrong_action_type'
      ) {
        throw new PlayerActionError('Choix invalide.', {
          gameType: 'ca-derape',
        });
      }
      if (!deltaValidation.ok) {
        const payload = asRecord(action.payload);
        throw new GameValidationError('Choix invalide.', {
          gameType: 'ca-derape',
          delta: toNumber(payload.delta),
        });
      }
      return deltaValidation.action;
    }
    throw new PlayerActionError('Choix invalide.', { gameType: 'ca-derape' });
  }

  const current = state.turn?.currentPlayerId ?? null;
  if (current != null && actorId !== current) {
    throw new PlayerActionError("Ce n'est pas votre tour.", {
      gameType: 'ca-derape',
      playerId: actorId,
      currentPlayerId: current,
    });
  }

  if (isRollActionType(rawType)) {
    return { type: 'roll', payload: {} };
  }
  return { type: normalized, payload: action.payload ?? {} };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value == null || typeof value !== 'object') return {};
  return value as Record<string, unknown>;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : NaN;
  }
  if (typeof value !== 'string') {
    return NaN;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : NaN;
}



