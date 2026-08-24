import type { GameStateEntity } from '../../models/game-state.model';
import type { GameSingleActionDto } from '../../models/game-action.model';
import {
  GameValidationError,
  PlayerActionError,
} from '../../../domain/errors/public-api';
import type { GameDefinition } from '../../models/game-definition.model';
import {
  normalizeActionType as normalizeRawActionType,
  normalizeRollActionType,
} from '../../helpers/action-service.helper';
import { canPlayerActOnTurn } from '../../helpers/rulebook-guard.helper';

export function getBoardMissionAvailableActions(
  state: GameStateEntity,
  playerId: number,
): GameSingleActionDto[] {
  if (!canPlayerActOnTurn(state, playerId)) return [];
  return [{ type: 'roll', payload: {} }];
}

export function validateBoardMissionAction<
  TGameId extends string,
  TEventId extends string,
  TActionType extends string,
  TPhaseId extends string,
  TPendingType extends string | null,
>(
  state: GameStateEntity,
  action: GameSingleActionDto,
  actorId: number | null,
  definition: GameDefinition<
    TGameId,
    TEventId,
    TActionType,
    TPhaseId,
    TPendingType
  >,
): GameSingleActionDto {
  const rawType = normalizeRawActionType(action);
  const type = normalizeRollActionType(rawType) as TActionType;
  if (!definition.actions.includes(type)) {
    throw new GameValidationError(`Action inconnue: ${rawType || '(vide)'}`, {
      gameType: definition.id,
      action: rawType,
      allowedActions: definition.actions,
    });
  }
  if (actorId == null) {
    throw new PlayerActionError('Acteur requis.', {
      gameType: definition.id,
    });
  }

  const status = String(state.status ?? '').toLowerCase();
  if (status !== 'started') {
    throw new PlayerActionError("La partie n'est pas dÃƒÆ’Ã‚Â©marrÃƒÆ’Ã‚Â©e.", {
      gameType: definition.id,
    });
  }

  if (state.pending) {
    throw new PlayerActionError('Action indisponible (choix en attente).', {
      gameType: definition.id,
    });
  }

  const current = state.turn?.currentPlayerId ?? null;
  if (current !== actorId) {
    throw new PlayerActionError("Ce n'est pas votre tour.", {
      gameType: definition.id,
      playerId: actorId,
      currentPlayerId: current,
    });
  }

  return { type: 'roll', payload: {} };
}




