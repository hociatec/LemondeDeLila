import { Injectable } from '@nestjs/common';
import { GameStateEntity } from '../models/game-state.model';

@Injectable()
export class TurnManagerService {
  setCurrent(state: GameStateEntity, playerId: number | null): GameStateEntity {
    return {
      ...state,
      turn: {
        currentPlayerId: playerId,
        direction: state.turn?.direction ?? 1,
      },
    };
  }

  next(
    state: GameStateEntity,
    livingIds: number[],
    offset = 1,
  ): GameStateEntity {
    if (!livingIds.length) return this.setCurrent(state, null);
    const currentId = state.turn?.currentPlayerId ?? null;
    const idx = currentId == null ? -1 : livingIds.indexOf(currentId);
    const nextIdx = idx < 0 ? 0 : (idx + offset) % livingIds.length;
    return this.setCurrent(state, livingIds[nextIdx] ?? null);
  }
}
