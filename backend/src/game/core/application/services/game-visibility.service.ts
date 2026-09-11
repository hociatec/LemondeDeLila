import { Injectable } from '@nestjs/common';
import type { GameState } from '../models/game-state.model';
import type { GameStateWithActions } from '../models/game-action.model';
import type { PendingState } from '../models/game-state.model';

@Injectable()
export class GameVisibilityService {
  project(
    _internal: GameState,
    exposed: GameStateWithActions,
    viewerPlayerId: number | null,
  ): GameStateWithActions {
    if (
      viewerPlayerId !== null &&
      (!Number.isSafeInteger(viewerPlayerId) || viewerPlayerId <= 0)
    ) {
      viewerPlayerId = null;
    }
    return structuredClone({
      viewVersion: exposed.viewVersion,
      system: exposed.system,
      kits: exposed.kits,
      effect: exposed.effect,
      game: exposed.game,
      ...(exposed.gameContract !== undefined
        ? {
            gameContract: {
              stateVersion: exposed.gameContract.stateVersion,
              rulesVersion: exposed.gameContract.rulesVersion,
              contentVersion: exposed.gameContract.contentVersion,
            },
          }
        : {}),
      ...(exposed.actions !== undefined ? { actions: exposed.actions } : {}),
      ...(exposed.actionCatalog !== undefined
        ? { actionCatalog: exposed.actionCatalog }
        : {}),
      ...(exposed.timers !== undefined ? { timers: exposed.timers } : {}),
      ...(exposed.pending !== undefined
        ? { pending: this.redactPending(exposed.pending, viewerPlayerId) }
        : {}),
    });
  }

  private redactPending(
    pending: PendingState | null | undefined,
    viewerPlayerId: number | null,
  ): PendingState | null | undefined {
    if (
      viewerPlayerId !== null &&
      (!Number.isSafeInteger(viewerPlayerId) || viewerPlayerId <= 0)
    ) {
      viewerPlayerId = null;
    }
    if (!pending) return pending;
    const hasTarget =
      Boolean(pending.playerIds?.length) || pending.playerId != null;
    const canAnswer =
      !hasTarget ||
      (viewerPlayerId != null &&
        !(pending.resolvedPlayerIds ?? []).includes(viewerPlayerId) &&
        (pending.playerIds?.length
          ? pending.playerIds.includes(viewerPlayerId)
          : pending.playerId === viewerPlayerId));
    const publicPending: PendingState = {};
    const keys = [
      'schemaVersion',
      'type',
      'choiceId',
      'workflowKind',
      'label',
      'playerId',
      'playerIds',
      'resolvedPlayerIds',
      'targetPlayerId',
      'blocking',
    ] as const;
    for (const key of keys) {
      if (Object.hasOwn(pending, key))
        Object.defineProperty(publicPending, key, {
          value: pending[key],
          enumerable: true,
        });
    }
    if (!canAnswer) return publicPending;
    return {
      ...publicPending,
      question: pending.question,
      choices: pending.choices,
      data: pending.data,
    };
  }
}
