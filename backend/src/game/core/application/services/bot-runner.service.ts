import { Injectable } from '@nestjs/common';
import { GameSingleActionDto } from '../contracts/game-action.model';
import { GameStateEntity } from '../contracts/game-state.model';
import type { GameRuntime } from '../contracts/game-runtime.interface';

@Injectable()
export class BotRunnerService {
  suggestForHandler(
    handler: GameRuntime | undefined,
    state: GameStateEntity,
    botPlayerId: number,
  ): GameSingleActionDto[] | null {
    if (!handler) return null;
    return handler.getBotActions(state, botPlayerId);
  }
}
