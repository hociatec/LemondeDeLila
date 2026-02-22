import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import {
  GameValidationError,
  PlayerActionError,
} from '../../../../../common/errors/game-errors';
import { PIRATES_GAME } from '../definitions/pirates-en-vadrouille.definition';
import {
  isRollAlias,
  normalizeActionType,
} from '../../../../actions/action-service.helper';
import { isStartedState } from '../../../../rulebook/rulebook-guard.helper';
import {
  getPendingChooseTargetActionsForPlayer,
  validatePendingChooseTargetActionForActor,
} from '../../../../core/helpers/pending-actions-rulebook.helper';
import type { PiratesEnVadrouilleActionType } from '../definitions/pirates-en-vadrouille.definition';

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

function isPiratesActionType(
  value: string,
): value is PiratesEnVadrouilleActionType {
  return (PIRATES_GAME.actions as readonly string[]).includes(value);
}

export function getAvailableActions(
  state: GameStateEntity,
  playerId: number,
): GameSingleActionDto[] {
  if (!isStartedState(state)) return [];

  const pending = state.pending;
  if (pending) {
    const targetActions = getPendingChooseTargetActionsForPlayer(
      pending,
      playerId,
      { targetsKey: 'options' },
    );
    if (targetActions.length > 0) return targetActions;
    return [];
  }

  const current = state.turn?.currentPlayerId ?? null;
  if (current !== playerId) return [];
  return [{ type: 'roll', payload: {} }];
}

export function validateAction(
  state: GameStateEntity,
  action: GameSingleActionDto,
  actorId: number | null,
): GameSingleActionDto {
  const normalizedType = normalizeActionType(action);
  const rawType = typeof normalizedType === 'string' ? normalizedType : '';
  const maybeType = isRollAlias(rawType) ? 'roll' : rawType;
  if (!isPiratesActionType(maybeType)) {
    throw new GameValidationError(`Action inconnue: ${rawType || '(vide)'}`, {
      gameType: 'pirates-en-vadrouille',
      action: rawType,
      allowedActions: PIRATES_GAME.actions,
    });
  }
  const type = maybeType;
  if (actorId == null) {
    throw new PlayerActionError('Acteur requis.', {
      gameType: 'pirates-en-vadrouille',
    });
  }

  const status = String(state.status ?? '').toLowerCase();
  if (status !== 'started') {
    throw new PlayerActionError("La partie n'est pas démarrée.", {
      gameType: 'pirates-en-vadrouille',
    });
  }

  const pending = state.pending;
  if (pending) {
    const targetValidation = validatePendingChooseTargetActionForActor({
      pending,
      actorId,
      actionType: type,
      payload: action.payload ?? {},
      targetsKey: 'options',
    });
    if (targetValidation.ok) {
      return targetValidation.action;
    }
    const pendingRow = asRecord(pending);
    if (
      pendingRow.type === 'choose_target' &&
      targetValidation.reason === 'wrong_action_type'
    ) {
      throw new PlayerActionError('Action non disponible.', {
        gameType: 'pirates-en-vadrouille',
      });
    }
    if (
      pendingRow.type === 'choose_target' &&
      targetValidation.reason === 'invalid_target'
    ) {
      throw new GameValidationError('Cible invalide.', {
        gameType: 'pirates-en-vadrouille',
        targetPlayerId: targetValidation.targetPlayerId,
      });
    }
    if (Number(pendingRow.playerId ?? null) !== actorId) {
      throw new PlayerActionError("Ce n'est pas votre action.", {
        gameType: 'pirates-en-vadrouille',
      });
    }
    throw new PlayerActionError('Action non disponible.', {
      gameType: 'pirates-en-vadrouille',
    });
  }

  const current = state.turn?.currentPlayerId ?? null;
  if (current != null && actorId !== current) {
    throw new PlayerActionError("Ce n'est pas votre tour.", {
      gameType: 'pirates-en-vadrouille',
      playerId: actorId,
      currentPlayerId: current,
    });
  }

  if (type === 'roll') return { type: 'roll', payload: action.payload ?? {} };
  return action;
}
