import { Injectable } from '@nestjs/common';
import type { GameRulesAdapter } from '../../../application/contracts/game-rules-adapter.interface';
import type { GameStateEntity } from '../../../application/models/game-state.model';
import type { GameShortcutHint } from '../../../application/models/game-shortcuts.model';
import { GameWsPayloadCompatibilityAdapter } from './game-ws-payload-compatibility.adapter';

type PresentStateInput = {
  state: GameStateEntity;
  handler: GameRulesAdapter;
  roomId: number;
  gameType: string;
  version: number;
  viewerPlayerId?: number | null;
};

@Injectable()
export class GameWsStatePresenter {
  constructor(
    private readonly compatibility: GameWsPayloadCompatibilityAdapter,
  ) {}

  present(input: PresentStateInput): Record<string, unknown> {
    const exposed = this.expose(
      input.handler,
      input.state,
      input.viewerPlayerId,
    );
    return this.compatibility.build(exposed, {
      roomId: input.roomId,
      gameType: input.gameType,
      version: input.version,
      viewerPlayerId: input.viewerPlayerId,
      shortcuts: this.resolveShortcuts(input.handler, input.state, exposed),
    });
  }

  private expose(
    handler: GameRulesAdapter,
    state: GameStateEntity,
    viewerPlayerId?: number | null,
  ): GameStateEntity {
    const viewerId = Number(viewerPlayerId ?? 0);
    if (
      handler.exposeStateForUser &&
      Number.isFinite(viewerId) &&
      viewerId > 0
    ) {
      return handler.exposeStateForUser(state, viewerId);
    }
    return handler.exposeState ? handler.exposeState(state) : state;
  }

  private resolveShortcuts(
    handler: GameRulesAdapter,
    state: GameStateEntity,
    exposed: GameStateEntity,
  ): GameShortcutHint[] {
    const shortcuts =
      handler.getShortcuts?.({
        metadata: state.metadata ?? {},
        currentPlayerId: state.turn?.currentPlayerId ?? null,
        started: String(state.status ?? '').toLowerCase() === 'started',
      }) ?? [];
    const rawActions = (exposed as GameStateEntity & { actions?: unknown })
      .actions;
    const actionTypes = new Set(
      (Array.isArray(rawActions) ? rawActions : [])
        .map((action) => this.asRecord(action).type)
        .filter((type): type is string => typeof type === 'string'),
    );
    return shortcuts.filter(
      (shortcut) =>
        shortcut.type === 'interface' || actionTypes.has(shortcut.actionType),
    );
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};
  }
}
