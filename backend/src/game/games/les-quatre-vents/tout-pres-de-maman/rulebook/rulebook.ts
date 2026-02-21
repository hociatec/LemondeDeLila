import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import {
  GameValidationError,
  PlayerActionError,
} from '../../../../../common/errors/game-errors';
import { TOUT_PRES_DE_MAMAN_GAME } from '../definitions/tout-pres-de-maman.definition';
import {
  normalizeActionType as normalizeRawActionType,
  normalizeRollActionType,
} from '../../../../actions/action-service.helper';
import { canPlayerActOnTurn } from '../../../../rulebook/rulebook-guard.helper';

export function getAvailableActions(
  state: GameStateEntity,
  playerId: number,
): GameSingleActionDto[] {
  if (!canPlayerActOnTurn(state, playerId)) return [];

  return [{ type: 'roll', payload: {} }];
}

export function validateAction(
  state: GameStateEntity,
  action: GameSingleActionDto,
  actorId: number | null,
): GameSingleActionDto {
  const rawType = normalizeRawActionType(action);
  const type = normalizeRollActionType(
    rawType,
  ) as (typeof TOUT_PRES_DE_MAMAN_GAME.actions)[number];
  if (!TOUT_PRES_DE_MAMAN_GAME.actions.includes(type)) {
    throw new GameValidationError(`Action inconnue: ${rawType || '(vide)'}`, {
      gameType: TOUT_PRES_DE_MAMAN_GAME.id,
      action: rawType,
      allowedActions: TOUT_PRES_DE_MAMAN_GAME.actions,
    });
  }
  if (actorId == null) {
    throw new PlayerActionError('Acteur requis.', {
      gameType: TOUT_PRES_DE_MAMAN_GAME.id,
    });
  }

  const status = String(state.status ?? '').toLowerCase();
  if (status !== 'started') {
    throw new PlayerActionError("La partie n'est pas démarrée.", {
      gameType: TOUT_PRES_DE_MAMAN_GAME.id,
    });
  }

  if (state.pending) {
    throw new PlayerActionError('Action indisponible (choix en attente).', {
      gameType: TOUT_PRES_DE_MAMAN_GAME.id,
    });
  }

  const current = state.turn?.currentPlayerId ?? null;
  if (current !== actorId) {
    throw new PlayerActionError("Ce n'est pas votre tour.", {
      gameType: TOUT_PRES_DE_MAMAN_GAME.id,
      playerId: actorId,
      currentPlayerId: current,
    });
  }

  return { type: 'roll', payload: {} };
}
