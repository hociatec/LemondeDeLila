import { GameSingleActionDto } from '../models/game-action.model';
import { GameStateEntity } from '../models/game-state.model';

export interface BotStrategy {
  suggest(
    state: GameStateEntity,
    botPlayerId: number,
  ): GameSingleActionDto[] | null;
}
