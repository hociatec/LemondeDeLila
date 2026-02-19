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
  ODYSSEE_GAME,
  type OdysseeActionType,
} from '../definitions/odyssee.definition';
import {
  getPendingPawnMoveActionsForPlayer,
  validatePendingPawnMoveActionForActor,
} from '../../../../core/helpers/pending-pawn-move-rulebook.helper';

export function getAvailableActions(
  state: GameStateEntity,
  playerId: number,
): GameSingleActionDto[] {
  if (!isStartedState(state)) return [];

  const pending = state.pending as any;
  if (pending) {
    const pendingMoveActions = getPendingPawnMoveActionsForPlayer(
      pending,
      playerId,
      'choose_pawn',
      'move_pawn',
    );
    if (pendingMoveActions.length > 0) {
      return pendingMoveActions;
    }
    if (pending.playerId !== playerId) return [];
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
  const type = normalizeLegacyRollAliasToUpper(rawType) as OdysseeActionType;
  if (!ODYSSEE_GAME.actions.includes(type)) {
    throw new GameValidationError(`Action inconnue: ${rawType || '(vide)'}`, {
      gameType: 'odyssee-quatre-cieux',
      action: rawType,
      allowedActions: ODYSSEE_GAME.actions,
    });
  }
  if (actorId == null)
    throw new PlayerActionError('Acteur requis.', {
      gameType: 'odyssee-quatre-cieux',
    });
  if (!isStartedState(state)) {
    throw new PlayerActionError("La partie n'est pas démarrée.", {
      gameType: 'odyssee-quatre-cieux',
    });
  }

  const pending = state.pending as any;
  if (pending) {
    const moveValidation = validatePendingPawnMoveActionForActor({
      pending,
      actorId,
      actionType: type,
      payload: action.payload ?? {},
      pendingType: 'choose_pawn',
      expectedActionType: 'move_pawn',
    });

    if (!moveValidation.ok && moveValidation.reason === 'not_pending_for_actor')
      throw new PlayerActionError("Ce n'est pas votre action.", {
        gameType: 'odyssee-quatre-cieux',
      });
    if (!moveValidation.ok && moveValidation.reason === 'wrong_action_type') {
      throw new PlayerActionError('Action non disponible.', {
        gameType: 'odyssee-quatre-cieux',
      });
    }
    if (!moveValidation.ok) {
      throw new GameValidationError('Payload invalide.', {
        gameType: 'odyssee-quatre-cieux',
        payload: action.payload,
      });
    }
    return moveValidation.action;
  }

  const current = state.turn?.currentPlayerId ?? null;
  if (current != null && actorId !== current) {
    throw new PlayerActionError("Ce n'est pas votre tour.", {
      gameType: 'odyssee-quatre-cieux',
      playerId: actorId,
      currentPlayerId: current,
    });
  }

  if (type === 'ROLL_DICE') return { type: 'roll', payload: {} };
  return { type: 'roll', payload: {} };
}




