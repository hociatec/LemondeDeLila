import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../core/entities/game-state.entity';
import { GameCoreService } from '../../../core/services/game-core.service';

@Injectable()
export class PromptPoliciesService {
  constructor(private readonly core: GameCoreService) {}

  appendLogOnce(state: GameStateEntity, message: string): GameStateEntity {
    const log = Array.isArray(state.log) ? state.log : [];
    const last = String(log[log.length - 1]?.message ?? '').trim();
    const normalizedMessage = String(message ?? '').trim();
    if (!normalizedMessage || last === normalizedMessage) return state;
    return this.core.appendLog(state, normalizedMessage);
  }

  ensurePendingPlayerPrompt(
    state: GameStateEntity,
    pendingType: string,
    buildMessage: (playerId: number) => string,
  ): GameStateEntity {
    const pending = state.pending as any;
    if (!pending || pending.type !== pendingType) return state;
    const chooserId =
      typeof pending.playerId === 'number'
        ? pending.playerId
        : state.turn?.currentPlayerId ?? null;
    if (chooserId == null) return state;
    return this.appendLogOnce(state, buildMessage(chooserId));
  }
}
