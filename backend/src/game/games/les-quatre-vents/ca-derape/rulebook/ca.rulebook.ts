import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import {
  isRollActionType,
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
  CA_DERAPE_GAME,
  type CaDerapeActionType,
} from '../definitions/ca.definition';
import {
  getPendingChooseTargetActionsForPlayer,
  getPendingDrawActionsForPlayer,
  validatePendingChooseTargetActionForActor,
  validatePendingDrawActionForActor,
} from '../../../../core/helpers/pending-actions-rulebook.helper';

export function getAvailableActions(
  state: GameStateEntity,
  playerId: number,
): GameSingleActionDto[] {
  if (!isStartedState(state)) return [];

  const pending = state.pending as any;
  if (pending) {
    const drawActions = getPendingDrawActionsForPlayer(pending, playerId);
    if (drawActions.length > 0) return drawActions;
    const targetActions = getPendingChooseTargetActionsForPlayer(
      pending,
      playerId,
    );
    if (targetActions.length > 0) return targetActions;
    if (pending.type === 'choose_next_player') {
      const ids: number[] = Array.isArray(pending?.data?.playerIds)
        ? pending.data.playerIds
        : [];
      return ids.map((id) => ({
        type: 'choose_next_player',
        payload: { playerId: id },
      }));
    }
    if (pending.type === 'choose_next_delta') {
      const deltas: number[] = Array.isArray(pending?.data?.deltas)
        ? pending.data.deltas
        : [];
      return deltas.map((delta) => ({
        type: 'choose_next_delta',
        payload: { delta },
      }));
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
  const normalized =
    normalizeLegacyRollAliasToUpper(rawType) as CaDerapeActionType;

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
    throw new PlayerActionError("La partie n'est pas démarrée.", {
      gameType: 'ca-derape',
    });
  }

  const pending: any = state.pending;
  if (pending) {
    const drawValidation = validatePendingDrawActionForActor({
      pending,
      actorId,
      actionType: normalized,
    });
    if (drawValidation.ok) {
      return drawValidation.action;
    }
    if (pending.type === 'draw' && drawValidation.reason === 'wrong_action_type') {
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
      throw new PlayerActionError('Action réservée à un autre joueur.', {
        gameType: 'ca-derape',
      });
    }
    if (pending.type === 'choose_target') {
      if (normalized !== 'choose_target') {
        throw new PlayerActionError('Choix invalide.', {
          gameType: 'ca-derape',
        });
      }
      throw new GameValidationError('Cible invalide.', {
        gameType: 'ca-derape',
      });
    }
    if (pending.type === 'choose_next_player') {
      if (normalized !== 'choose_next_player') {
        throw new PlayerActionError('Choix invalide.', {
          gameType: 'ca-derape',
        });
      }
      const ids: number[] = Array.isArray(pending?.data?.playerIds)
        ? pending.data.playerIds
        : [];
      const playerId = Number((action.payload as any)?.playerId);
      if (!Number.isFinite(playerId) || !ids.includes(playerId)) {
        throw new GameValidationError('Joueur invalide.', {
          gameType: 'ca-derape',
          playerId,
        });
      }
      return { type: 'choose_next_player', payload: { playerId } };
    }
    if (pending.type === 'choose_next_delta') {
      if (normalized !== 'choose_next_delta') {
        throw new PlayerActionError('Choix invalide.', {
          gameType: 'ca-derape',
        });
      }
      const deltas: number[] = Array.isArray(pending?.data?.deltas)
        ? pending.data.deltas
        : [];
      const delta = Number((action.payload as any)?.delta);
      if (!Number.isFinite(delta) || !deltas.includes(delta)) {
        throw new GameValidationError('Choix invalide.', {
          gameType: 'ca-derape',
          delta,
        });
      }
      return { type: 'choose_next_delta', payload: { delta } };
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



