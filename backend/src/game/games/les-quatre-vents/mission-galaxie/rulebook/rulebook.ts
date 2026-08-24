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
  MISSION_GALAXIE_GAME,
  type MissionGalaxieActionType,
} from '../definitions/mission-galaxie.definition';
import {
  getPendingDrawActionsForPlayer,
  getPendingIndexedChoiceActionsForPlayer,
  validatePendingDrawActionForActor,
  validatePendingIndexedChoiceActionForActor,
} from '../../../../application/helpers/pending-actions-rulebook.helper';

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

function readEventMoveOptions(
  pending: unknown,
): Array<{ targetPlayerId: number; delta: number }> {
  const row = asRecord(pending);
  const data = asRecord(row.data);
  const options = Array.isArray(data.options) ? data.options : [];
  return options
    .map((entry) => {
      const option = asRecord(entry);
      return {
        targetPlayerId: Number(option.targetPlayerId),
        delta: Number(option.delta),
      };
    })
    .filter(
      (entry) =>
        Number.isFinite(entry.targetPlayerId) && Number.isFinite(entry.delta),
    );
}

export function getAvailableActions(
  state: GameStateEntity,
  playerId: number,
): GameSingleActionDto[] {
  if (!isStartedState(state)) return [];

  const pending = state.pending;
  if (pending) {
    const pendingRow = asRecord(pending);
    if (Number(pendingRow.playerId ?? null) !== playerId) return [];
    const drawActions = getPendingDrawActionsForPlayer(pending, playerId);
    if (drawActions.length > 0) return drawActions;
    if (pendingRow.type === 'choose_option') {
      return getPendingIndexedChoiceActionsForPlayer(pending, playerId, {
        pendingType: 'choose_option',
        actionType: 'choose_option',
        payloadIndexKey: 'choiceIndex',
        choicesContainer: 'data',
        choicesKey: 'choices',
      });
    }
    if (pendingRow.type === 'choose_event_move') {
      const options = readEventMoveOptions(pending);
      return options.map((opt) => ({
        type: 'choose_event_move',
        payload: { targetPlayerId: opt.targetPlayerId, delta: opt.delta },
      }));
    }
    return [];
  }

  const current = state.turn?.currentPlayerId ?? null;
  if (current !== playerId) return [];
  return [{ type: 'roll' }, { type: 'ROLL_DICE' }];
}

export function validateAction(
  state: GameStateEntity,
  action: GameSingleActionDto,
  actorId: number | null,
): GameSingleActionDto {
  const rawType = normalizeActionType(action);
  const type = normalizeLegacyRollAliasToUpper(
    rawType,
  ) as MissionGalaxieActionType;
  if (!MISSION_GALAXIE_GAME.actions.includes(type)) {
    throw new GameValidationError(`Action inconnue: ${rawType || '(vide)'}`, {
      gameType: 'mission-galaxie',
      action: rawType,
      allowedActions: MISSION_GALAXIE_GAME.actions,
    });
  }
  if (actorId == null) {
    throw new PlayerActionError('Acteur requis.', {
      gameType: 'mission-galaxie',
    });
  }

  if (!isStartedState(state)) {
    throw new PlayerActionError("La partie n'est pas dÃƒÂ©marrÃƒÂ©e.", {
      gameType: 'mission-galaxie',
    });
  }

  const pending = state.pending;
  if (pending) {
    const pendingRow = asRecord(pending);
    if (Number(pendingRow.playerId ?? null) !== actorId) {
      throw new PlayerActionError("Ce n'est pas votre action.", {
        gameType: 'mission-galaxie',
      });
    }
    const drawValidation = validatePendingDrawActionForActor({
      pending,
      actorId,
      actionType: type,
    });
    if (drawValidation.ok) {
      return drawValidation.action;
    }
    if (
      pendingRow.type === 'draw' &&
      drawValidation.reason === 'wrong_action_type'
    ) {
      throw new PlayerActionError('Action non disponible.', {
        gameType: 'mission-galaxie',
      });
    }
    if (pendingRow.type === 'choose_option') {
      const choiceValidation = validatePendingIndexedChoiceActionForActor({
        pending,
        actorId,
        actionType: type,
        payload: action.payload ?? {},
        pendingType: 'choose_option',
        expectedActionType: 'choose_option',
        payloadIndexKey: 'choiceIndex',
        choicesContainer: 'data',
        choicesKey: 'choices',
      });
      if (
        !choiceValidation.ok &&
        choiceValidation.reason === 'wrong_action_type'
      ) {
        throw new PlayerActionError('Action non disponible.', {
          gameType: 'mission-galaxie',
        });
      }
      if (!choiceValidation.ok) {
        const payload = asRecord(action.payload);
        throw new GameValidationError('Choix invalide.', {
          gameType: 'mission-galaxie',
          choiceIndex: Number(payload.choiceIndex),
        });
      }
      return choiceValidation.action;
    }
    if (pendingRow.type === 'choose_event_move') {
      if (type !== 'choose_event_move') {
        throw new PlayerActionError('Action non disponible.', {
          gameType: 'mission-galaxie',
        });
      }
      const options = readEventMoveOptions(pending);
      const payload = asRecord(action.payload);
      const targetPlayerId = Number(payload.targetPlayerId);
      const delta = Number(payload.delta);
      if (
        !Number.isFinite(targetPlayerId) ||
        !Number.isFinite(delta) ||
        !options.some(
          (opt) => opt.targetPlayerId === targetPlayerId && opt.delta === delta,
        )
      ) {
        throw new GameValidationError('Choix invalide.', {
          gameType: 'mission-galaxie',
          targetPlayerId,
          delta,
        });
      }
      return {
        type: 'choose_event_move',
        payload: { targetPlayerId, delta },
      };
    }
    throw new PlayerActionError('Action non disponible.', {
      gameType: 'mission-galaxie',
    });
  }

  const current = state.turn?.currentPlayerId ?? null;
  if (current != null && actorId !== current) {
    throw new PlayerActionError("Ce n'est pas votre tour.", {
      gameType: 'mission-galaxie',
      playerId: actorId,
      currentPlayerId: current,
    });
  }

  if (type === 'ROLL_DICE') return { type: 'roll', payload: {} };
  return { type, payload: action.payload ?? {} };
}



