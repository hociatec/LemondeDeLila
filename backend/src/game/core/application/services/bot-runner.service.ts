import { Injectable } from '@nestjs/common';
import { GameSingleActionDto } from '../models/game-action.model';
import { GameStateEntity } from '../models/game-state.model';
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
