import { GameSingleActionDto } from '../../engine/dto/game-action.dto';
import { GameStateEntity } from '../../core/entities/game-state.entity';

export interface BotStrategy {
  suggest(
    state: GameStateEntity,
    botPlayerId: number,
  ): GameSingleActionDto[] | null;
}
