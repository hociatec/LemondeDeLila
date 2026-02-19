import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import {
  normalizeActionType,
  normalizeLegacyRollAliasToUpper,
  normalizeLowerActionType,
} from '../../../../actions/action-service.helper';
import { isStartedState } from '../../../../rulebook/rulebook-guard.helper';
import {
  GameValidationError,
  PlayerActionError,
} from '../../../../../common/errors/game-errors';
import {
  MISSION_GALAXIE_GAME,
  type MissionGalaxieActionType,
} from '../definitions/mission-galaxie.definition';
import {
  getPendingDrawActionsForPlayer,
  getPendingIndexedChoiceActionsForPlayer,
  validatePendingDrawActionForActor,
  validatePendingIndexedChoiceActionForActor,
} from '../../../../core/helpers/pending-actions-rulebook.helper';

export function getAvailableActions(
  state: GameStateEntity,
  playerId: number,
): GameSingleActionDto[] {
  if (!isStartedState(state)) return [];

  const pending = state.pending as any;
  if (pending) {
    if (pending.playerId !== playerId) return [];
    const drawActions = getPendingDrawActionsForPlayer(pending, playerId);
    if (drawActions.length > 0) return drawActions;
    if (pending.type === 'choose_option') {
      return getPendingIndexedChoiceActionsForPlayer(pending, playerId, {
        pendingType: 'choose_option',
        actionType: 'choose_option',
        payloadIndexKey: 'choiceIndex',
        choicesContainer: 'data',
        choicesKey: 'choices',
      });
    }
    if (pending.type === 'choose_event_move') {
      const options: Array<{ targetPlayerId: number; delta: number }> =
        Array.isArray(pending?.data?.options) ? pending.data.options : [];
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
  const type = normalizeLegacyRollAliasToUpper(rawType) as MissionGalaxieActionType;
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
    throw new PlayerActionError("La partie n'est pas démarrée.", {
      gameType: 'mission-galaxie',
    });
  }

  const pending = state.pending as any;
  if (pending) {
    if (pending.playerId !== actorId) {
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
    if (pending.type === 'draw' && drawValidation.reason === 'wrong_action_type') {
      throw new PlayerActionError('Action non disponible.', {
        gameType: 'mission-galaxie',
      });
    }
    if (pending.type === 'choose_option') {
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
      if (!choiceValidation.ok && choiceValidation.reason === 'wrong_action_type') {
        throw new PlayerActionError('Action non disponible.', {
          gameType: 'mission-galaxie',
        });
      }
      if (!choiceValidation.ok) {
        throw new GameValidationError('Choix invalide.', {
          gameType: 'mission-galaxie',
          choiceIndex: Number((action.payload as any)?.choiceIndex),
        });
      }
      return choiceValidation.action;
    }
    if (pending.type === 'choose_event_move') {
      if (type !== 'choose_event_move') {
        throw new PlayerActionError('Action non disponible.', {
          gameType: 'mission-galaxie',
        });
      }
      const options: Array<{ targetPlayerId: number; delta: number }> =
        Array.isArray(pending?.data?.options) ? pending.data.options : [];
      const targetPlayerId = Number((action.payload as any)?.targetPlayerId);
      const delta = Number((action.payload as any)?.delta);
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




