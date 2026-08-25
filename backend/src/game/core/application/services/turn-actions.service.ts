import { Injectable } from '@nestjs/common';
import { GameSingleActionDto } from '../models/game-action.model';

export type PendingRequirement = {
  playerId: number;
  type: string;
};

@Injectable()
export class TurnActionsService {
  buildAvailableActions(params: {
    state: {
      status?: string;
      turn?: { currentPlayerId: number | null };
      turnIndex: number;
    };
    playerId: number;
    pending?: PendingRequirement | null;
    base?: GameSingleActionDto[];
  }): GameSingleActionDto[] {
    const { state, playerId, pending, base } = params;
    if (state.status === 'finished') return [];
    const current = state.turn?.currentPlayerId ?? null;
    if (current !== playerId) return [];
    if (pending) {
      return base ?? [];
    }
    return base ?? [];
  }
}

