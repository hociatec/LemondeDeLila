import { Injectable } from '@nestjs/common';
import { GameSingleActionDto } from '../models/game-action.model';
import { GameState } from '../models/game-state.model';
import type { GameRuntime } from '../ports/game-runtime.port';

@Injectable()
export class BotRunnerService {
  suggestForHandler(
    handler: GameRuntime | undefined,
    state: GameState,
    botPlayerId: number,
  ): GameSingleActionDto[] | null {
    if (!handler) return null;
    return handler.getBotActions(state, botPlayerId);
  }
}
