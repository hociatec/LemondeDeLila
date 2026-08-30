import { GameSingleActionDto } from '../contracts/game-action.model';
import { GameStateEntity } from '../contracts/game-state.model';

export interface BotStrategy {
  suggest(
    state: GameStateEntity,
    botPlayerId: number,
  ): GameSingleActionDto[] | null;
}
