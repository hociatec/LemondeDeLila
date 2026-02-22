import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { PlayerActionError } from '../../../../../common/errors/game-errors';
import { PRIMALIS_GAME } from '../definitions/primalis.definition';
import {
  isRollAlias,
  normalizeActionType,
} from '../../../../actions/action-service.helper';
import { canPlayerActOnTurn } from '../../../../rulebook/rulebook-guard.helper';
import type { PrimalisActionType } from '../definitions/primalis.definition';

function isPrimalisActionType(value: string): value is PrimalisActionType {
  return (PRIMALIS_GAME.actions as readonly string[]).includes(value);
}

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
  const normalizedType = normalizeActionType(action);
  const rawType = typeof normalizedType === 'string' ? normalizedType : '';
  const maybeType = isRollAlias(rawType) ? 'roll' : rawType;
  if (!isPrimalisActionType(maybeType)) {
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
    throw new PlayerActionError("La partie n'est pas démarrée.", {
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
