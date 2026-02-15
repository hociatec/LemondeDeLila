import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import {
  PlayerActionError,
} from '../../../../../common/errors/game-errors';
import { PRIMALIS_GAME } from '../definitions/primalis.definition';
import { normalizeActionType, normalizeLowerActionType } from '../../../../actions/action-service.helper';
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
  const rawType = normalizeActionType(action);
  const type =
    rawType === 'ROLL_DICE'
      ? 'roll'
      : rawType === 'roll_dice'
        ? 'roll'
        : (rawType as typeof PRIMALIS_GAME.actions[number]);
  if (!PRIMALIS_GAME.actions.includes(type as any)) {
    throw new PlayerActionError(`Action inconnue: ${rawType || '(vide)'}`, {
      gameType: 'primalis',
    });
  }
  if (actorId == null) {
    throw new PlayerActionError('Acteur requis.', {
      gameType: 'primalis',
    });
  }
  const status = String(state.status ?? '').toLowerCase();
  if (status !== 'started') {
    throw new PlayerActionError("La partie n'est pas dÃ©marrÃ©e.", {
      gameType: 'primalis',
    });
  }
  const current = state.turn?.currentPlayerId ?? null;
  if (current != null && actorId !== current) {
    throw new PlayerActionError("Ce n'est pas votre tour.", {
      gameType: 'primalis',
      playerId: actorId,
      currentPlayerId: current,
    });
  }
  return { type: 'roll', payload: {} };
}



