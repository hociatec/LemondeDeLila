import { Injectable } from '@nestjs/common';
import { GameStateEntity } from '../models/game-state.model';
import { TurnService } from './turn.service';
import { TurnPoliciesService } from './turn-policies.service';

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

    const meta = this.asRecord(state.metadata);
    const statuses = this.asRecord(meta.statuses);
    const skipTurn: Record<number, number> = statuses.skipTurn ?? {};

    const currentId = state.turn?.currentPlayerId ?? null;
    const currentIndex =
      currentId != null
        ? players.findIndex((p) => p?.id === currentId)
        : state.turnIndex;
    const next = this.turns.nextTurn(
      players as Array<{ id: number }>,
      currentIndex >= 0 ? currentIndex : state.turnIndex,
      skipTurn,
    );
    const skipped = this.getSkipped(next);
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

  private asRecord(value: unknown): Record<string, unknown> {
    return value != null && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};
  }

  private getSkipped(value: unknown): number[] {
    const record = this.asRecord(value);
    return Array.isArray(record.skipped)
      ? record.skipped.filter(
          (entry): entry is number =>
            typeof entry === 'number' && Number.isFinite(entry),
        )
      : [];
  }
}
