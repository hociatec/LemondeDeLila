import { Injectable } from '@nestjs/common';
import { GameStateEntity } from '../../../core/entities/game-state.entity';
import { TurnService } from './turn.service';
import { TurnPoliciesService } from '../../turn-policies/services/turn-policies.service';

export interface AdvanceTurnOptions {
  skipAnnouncement?: boolean;
  playerNameResolver?: (state: GameStateEntity, playerId: number) => string;
}

@Injectable()
export class TurnFlowService {
  constructor(
    private readonly turns: TurnService,
    private readonly turnPolicies: TurnPoliciesService,
  ) {}

  advanceTurn(
    state: GameStateEntity,
    options?: AdvanceTurnOptions,
  ): GameStateEntity {
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
    const skipped = Array.isArray((next as any).skipped)
      ? (next as any).skipped
      : [];
    const turnFlow =
      meta && typeof meta === 'object' && !Array.isArray(meta)
        ? meta.turnFlow
        : null;
    const nextTurnFlow =
      skipped.length > 0
        ? {
            ...(turnFlow &&
            typeof turnFlow === 'object' &&
            !Array.isArray(turnFlow)
              ? turnFlow
              : {}),
            skipped,
          }
        : turnFlow;

    let result: GameStateEntity = {
      ...state,
      turnIndex: next.turnIndex,
      turn: { currentPlayerId: next.currentPlayerId, direction: 1 },
      metadata: {
        ...meta,
        statuses: { ...statuses, skipTurn: next.skipTurn },
        ...(nextTurnFlow ? { turnFlow: nextTurnFlow } : {}),
      },
    };

    if (!(options?.skipAnnouncement ?? false)) {
      const playerId = result.turn?.currentPlayerId ?? null;
      result = this.turnPolicies.appendTurnAnnouncement(
        result,
        playerId,
        options?.playerNameResolver,
      );
    }
    return result;
  }
}
