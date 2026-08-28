import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../models/game-state.model';

@Injectable()
export class GameVisibilityService {
  project(
    _internal: GameStateEntity,
    exposed: GameStateEntity,
    viewerPlayerId: number | null,
  ): GameStateEntity {
    const view = structuredClone(exposed);
    delete (view as GameStateEntity & { engine?: unknown }).engine;
    view.metadata = {};
    view.pending = this.redactPending(view.pending, viewerPlayerId);
    return view;
  }

  private redactPending(
    pending: GameStateEntity['pending'],
    viewerPlayerId: number | null,
  ): GameStateEntity['pending'] {
    if (!pending) return pending;
    const hasTarget =
      Boolean(pending.playerIds?.length) || pending.playerId != null;
    const canAnswer =
      !hasTarget ||
      (viewerPlayerId != null &&
        (pending.playerIds?.length
          ? pending.playerIds.includes(viewerPlayerId) &&
            !(pending.resolvedPlayerIds ?? []).includes(viewerPlayerId)
          : pending.playerId === viewerPlayerId));
    const {
      choices: _choices,
      data: _data,
      question: _question,
      queue: _queue,
      ...publicPending
    } = pending;
    if (!canAnswer) return publicPending;
    return {
      ...publicPending,
      question: pending.question,
      choices: pending.choices,
      data: pending.data,
    };
  }
}
