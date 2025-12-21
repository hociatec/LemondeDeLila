import type { GameStateEntity } from '../../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../../engine/dto/game-action.dto';

export function getAvailableActions(
  _state: GameStateEntity,
  _playerId: number,
): GameSingleActionDto[] {
  return [];
}

export function validateAction(
  _state: GameStateEntity,
  action: GameSingleActionDto,
  _actorId: number | null,
): GameSingleActionDto {
  return action;
}
