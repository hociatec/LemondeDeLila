import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import {
  GameValidationError,
  PlayerActionError,
} from '../../../../../common/errors/game-errors';
import type { MonVillageActionType } from '../definitions/mon-village.definition';
import { MON_VILLAGE_GAME } from '../definitions/mon-village.definition';
import {
  normalizeActionType as normalizeRawActionType,
  normalizeRollActionType,
} from '../../../../actions/action-service.helper';
import { isStartedState } from '../../../../rulebook/rulebook-guard.helper';

export function getAvailableActions(
  state: GameStateEntity,
  playerId: number,
): GameSingleActionDto[] {
  if (!isStartedState(state)) return [];

  if (state.pending) return [];

  const current = state.turn?.currentPlayerId ?? null;
  if (current !== playerId) {
    return [];
  }

  return [{ type: 'roll', payload: {} }];
}

export function validateAction(
  state: GameStateEntity,
  action: GameSingleActionDto,
  actorId: number | null,
): GameSingleActionDto {
  const rawType = normalizeRawActionType(action);
  const type = normalizeRollActionType(rawType) as MonVillageActionType;
  if (!MON_VILLAGE_GAME.actions.includes(type)) {
    throw new GameValidationError(`Action inconnue: ${rawType || '(vide)'}`, {
      gameType: 'mon-village-mon-histoire',
      action: rawType,
      allowedActions: MON_VILLAGE_GAME.actions,
    });
  }
  if (actorId == null) {
    throw new PlayerActionError('Acteur requis.', {
      gameType: 'mon-village-mon-histoire',
    });
  }

  const status = String(state.status ?? '').toLowerCase();
  if (status !== 'started') {
    throw new PlayerActionError("La partie n'est pas démarrée.", {
      gameType: 'mon-village-mon-histoire',
    });
  }

  if (state.pending) {
    throw new PlayerActionError('Action indisponible (choix en attente).', {
      gameType: 'mon-village-mon-histoire',
    });
  }

  const current = state.turn?.currentPlayerId ?? null;
  if (current !== actorId) {
    throw new PlayerActionError("Ce n'est pas votre tour.", {
      gameType: 'mon-village-mon-histoire',
      playerId: actorId,
      currentPlayerId: current,
    });
  }

  return { type: 'roll', payload: {} };
}
