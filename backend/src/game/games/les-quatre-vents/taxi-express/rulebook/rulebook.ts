import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import {
  GameValidationError,
  PlayerActionError,
} from '../../../../../common/errors/game-errors';
import type { TaxiExpressActionType } from '../definitions/taxi-express.definition';
import { TAXI_EXPRESS_GAME } from '../definitions/taxi-express.definition';
import { normalizeActionType as normalizeRawActionType } from '../../../../actions/action-service.helper';
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
  const type = normalizeActionType(rawType);
  if (!TAXI_EXPRESS_GAME.actions.includes(type)) {
    throw new GameValidationError(`Action inconnue: ${rawType || '(vide)'}`, {
      gameType: TAXI_EXPRESS_GAME.id,
      action: rawType,
      allowedActions: TAXI_EXPRESS_GAME.actions,
    });
  }
  if (actorId == null) {
    throw new PlayerActionError('Acteur requis.', {
      gameType: TAXI_EXPRESS_GAME.id,
    });
  }

  const status = String(state.status ?? '').toLowerCase();
  if (status !== 'started') {
    throw new PlayerActionError("La partie n'est pas dÃ©marrÃ©e.", {
      gameType: TAXI_EXPRESS_GAME.id,
    });
  }

  if (state.pending) {
    throw new PlayerActionError('Action indisponible (choix en attente).', {
      gameType: TAXI_EXPRESS_GAME.id,
    });
  }

  const current = state.turn?.currentPlayerId ?? null;
  if (current !== actorId) {
    throw new PlayerActionError("Ce n'est pas votre tour.", {
      gameType: TAXI_EXPRESS_GAME.id,
      playerId: actorId,
      currentPlayerId: current,
    });
  }

  return { type: 'roll', payload: {} };
}

function normalizeActionType(rawType: string): TaxiExpressActionType {
  if (!rawType) return 'roll';
  const normalized =
    rawType === 'ROLL_DICE' || rawType === 'roll_dice' ? 'roll' : rawType;
  return normalized as TaxiExpressActionType;
}



