import { Injectable } from '@nestjs/common';
import type { GameRuntime } from '../../../../application/contracts/game-runtime.interface';
import type { GameStateEntity } from '../../../../application/contracts/game-state.model';
import type { GameStateWithActions } from '../../../../application/contracts/game-action.model';
import type { GameShortcutHint } from '../../../../../shortcuts/public-api';
import { projectDiceActionView } from '../../../../../engine/runtime/projection/dice-action-view';
import { GameVisibilityService } from '../../../../application/services/game-visibility.service';

type PresentStateInput = {
  state: GameStateEntity;
  handler: GameRuntime;
  roomId: number;
  gameType: string;
  version: number;
  viewerPlayerId?: number | null;
};

@Injectable()
export class GameWsStatePresenter {
  constructor(private readonly visibility: GameVisibilityService) {}

  present(input: PresentStateInput): Record<string, unknown> {
    const exposedByGame = this.expose(
      input.handler,
      input.state,
      input.viewerPlayerId,
    );
    const exposed = projectDiceActionView(
      this.visibility.project(
        input.state,
        exposedByGame,
        Number(input.viewerPlayerId ?? 0) || null,
      ),
    );
    return {
      ...exposed,
      roomId: input.roomId,
      gameType: input.gameType,
      version: input.version,
      system: {
        ...this.asRecord(exposed.system),
        shortcuts: this.resolveShortcuts(input.handler, input.state, exposed),
      },
    };
  }

  private expose(
    handler: GameRuntime,
    state: GameStateEntity,
    viewerPlayerId?: number | null,
  ): GameStateWithActions {
    const viewerId = Number(viewerPlayerId ?? 0);
    if (Number.isFinite(viewerId) && viewerId > 0) {
      return handler.exposeStateForUser(state, viewerId);
    }
    return handler.exposeStateForUser(state, null);
  }

  private resolveShortcuts(
    handler: GameRuntime,
    state: GameStateEntity,
    exposed: GameStateWithActions,
  ): GameShortcutHint[] {
    const shortcuts = handler.getShortcuts({
      currentPlayerId: state.turn?.currentPlayerId ?? null,
      started: String(state.status ?? '').toLowerCase() === 'started',
    });
    const rawActions = exposed.actions;
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
