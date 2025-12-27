import { Injectable } from '@nestjs/common';
import { GameStateEntity } from '../../../core/entities/game-state.entity';
import { TurnService } from './turn.service';

@Injectable()
export class TurnFlowService {
  constructor(private readonly turns: TurnService) {}

  advanceTurn(state: GameStateEntity): GameStateEntity {
    const players = Array.isArray(state.players) ? state.players : [];
    if (!players.length) return state;

    const meta: any = state.metadata ?? {};
    const statuses: any = meta.statuses ?? {};
    const skipTurn: Record<number, number> = statuses.skipTurn ?? {};

    const currentId = state.turn?.currentPlayerId ?? null;
    const currentIndex =
      currentId != null
        ? players.findIndex((p: any) => p?.id === currentId)
        : state.turnIndex;
    const next = this.turns.nextTurn(
      players as Array<{ id: number }>,
      currentIndex >= 0 ? currentIndex : state.turnIndex,
      skipTurn,
    );

    return {
      ...state,
      turnIndex: next.turnIndex,
      turn: { currentPlayerId: next.currentPlayerId, direction: 1 },
      metadata: {
        ...meta,
        statuses: { ...statuses, skipTurn: next.skipTurn },
      },
    };
  }
}
