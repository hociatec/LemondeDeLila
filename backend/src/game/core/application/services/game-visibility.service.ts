import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../contracts/game-state.model';
import type { GameStateWithActions } from '../contracts/game-action.model';
import type { PendingState } from '../contracts/game-state.model';

@Injectable()
export class GameVisibilityService {
  project<TView extends GameStateEntity | GameStateWithActions>(
    _internal: GameStateEntity,
    exposed: TView,
    viewerPlayerId: number | null,
  ): TView {
    const view = structuredClone(exposed);
    Reflect.deleteProperty(view, 'engine');
    if ('metadata' in view) view.metadata = {};
    view.pending = this.redactPending(view.pending, viewerPlayerId);
    return view;
  }

  private redactPending(
    pending: PendingState | null | undefined,
    viewerPlayerId: number | null,
  ): PendingState | null | undefined {
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
