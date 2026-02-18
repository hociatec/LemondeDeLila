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
  isPendingPawnMoveForPlayer,
  listPendingPawnMoveActions,
  resolvePendingPawnMove,
} from '../../../../core/helpers/pawn-move-selection.helper';

export function getAvailableActions(
  state: GameStateEntity,
  playerId: number,
): GameSingleActionDto[] {
  if (!isStartedState(state)) return [];

  const pending = state.pending as any;
  if (pending) {
    if (isPendingPawnMoveForPlayer(pending, playerId, 'choose_pawn')) {
      return listPendingPawnMoveActions(pending, 'move_pawn');
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
    if (!isPendingPawnMoveForPlayer(pending, actorId, 'choose_pawn'))
      throw new PlayerActionError("Ce n'est pas votre action.", {
        gameType: 'odyssee-quatre-cieux',
      });
    if (type !== 'move_pawn') {
      throw new PlayerActionError('Action non disponible.', {
        gameType: 'odyssee-quatre-cieux',
      });
    }
    const move = resolvePendingPawnMove(pending, action.payload ?? {});
    if (!move) {
      throw new GameValidationError('Payload invalide.', {
        gameType: 'odyssee-quatre-cieux',
        payload: action.payload,
      });
    }
    return { type: 'move_pawn', payload: move };
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




