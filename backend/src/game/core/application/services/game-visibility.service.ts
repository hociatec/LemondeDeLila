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
    if (!pending || pending.playerId == null) return pending;
    if (pending.playerId === viewerPlayerId) return pending;
    const {
      choices: _choices,
      data: _data,
      question: _question,
      ...publicPending
    } = pending;
    return publicPending;
  }
}
