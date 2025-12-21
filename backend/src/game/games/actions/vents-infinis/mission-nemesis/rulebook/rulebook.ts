import type { GameSingleActionDto } from '../../../../../engine/dto/game-action.dto';
import type { GameStateEntity } from '../../../../../core/entities/game-state.entity';
import { GameValidationError } from '../../../../../../common/errors/game-errors';

export function getAvailableActions(
  _state: GameStateEntity,
  _playerId: number,
): GameSingleActionDto[] {
  return [];
}

export function validateAction(
  _state: GameStateEntity,
  action: GameSingleActionDto,
): GameSingleActionDto {
  const actionType = String(action?.type ?? '').trim();
  throw new GameValidationError(`Action inconnue: ${actionType}`, {
    gameType: 'mission-nemesis',
    action: actionType,
  });
}
