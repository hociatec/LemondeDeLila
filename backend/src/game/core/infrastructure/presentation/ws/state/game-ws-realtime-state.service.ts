import { Injectable } from '@nestjs/common';
import type { WsSession } from '../../../../../../platform/realtime/public-api';
import { WsApiHubService } from '../../../../../../platform/ws/public-api';
import type { GameRuntime } from '../../../../application/ports/game-runtime.port';
import type { GameState } from '../../../../application/models/game-state.model';
import { GameRoomStateFactory } from '../../../../application/services/game-room-state.factory';
import { GameEngineService } from '../../../../application/services/game-engine.service';
import { GameRealtimeAutomationService } from '../../../../application/services/game-realtime-automation.service';
import { GameRegistryService } from '../../../../application/services/game-registry.service';
import { GameWsRoomContextService } from '../game-ws-room-context.service';
import { GameWsStatePresenter } from './game-ws-state.presenter';
import { GameExecutionScopeService } from '../../../../application/services/game-execution-scope.service';
import { gameStateVersion } from '../../../../application/helpers/game-state-version';

import {
  GameRoomStateLifecycle,
  type ResolvedGameState,
} from '../../../../application/services/game-room-state-lifecycle';
export type { ResolvedGameState } from '../../../../application/services/game-room-state-lifecycle';
@Injectable()
export class GameWsRealtimeStateService {
  private readonly lifecycle: GameRoomStateLifecycle;
  private readonly latestSentVersions = new Map<
    string,
    {
      roomId: number;
      gameType: string;
      runId: number;
      version: number;
    }
  >();
  constructor(
    stateFactory: GameRoomStateFactory,
    engine: GameEngineService,
    registry: GameRegistryService,
    automation: GameRealtimeAutomationService,
    private readonly presenter: GameWsStatePresenter,
    private readonly hub: WsApiHubService,
    rooms: GameWsRoomContextService,
    execution: GameExecutionScopeService,
  ) {
    this.lifecycle = new GameRoomStateLifecycle(
      stateFactory,
      engine,
      registry,
      automation,
      rooms,
      execution,
      (roomId, gameType, state, handler, version) =>
        this.broadcast(roomId, gameType, state, handler, version),
    );
    automation.setStateCommittedHandler?.(async (committed) => {
      await this.lifecycle.publishCommittedState(
        committed.roomId,
        committed.gameType,
        committed.state,
        committed.handler,
        committed.version,
      );
    });
  }
  resolve(roomId: number): Promise<ResolvedGameState> {
    return this.lifecycle.resolve(roomId);
  }
  schedule(roomId: number, resolved: ResolvedGameState): void {
    this.lifecycle.schedule(roomId, resolved);
  }
  commit(
    roomId: number,
    resolved: ResolvedGameState,
    previous: GameState,
    next: GameState,
  ): Promise<void> {
    return this.lifecycle.commit(roomId, resolved, previous, next);
  }
  clear(roomId: number, gameType: string): Promise<void> {
    return this.lifecycle.clear(roomId, gameType).finally(() => {
      this.clearSentVersions(roomId, gameType);
    });
  }
  clearRoom(roomId: number): Promise<void> {
    return this.lifecycle.clearRoom(roomId).finally(() => {
      for (const [key, sent] of this.latestSentVersions) {
        if (sent.roomId === roomId) this.latestSentVersions.delete(key);
      }
    });
  }
  present(
    resolved: ResolvedGameState,
    roomId: number,
    viewerPlayerId: number,
  ): Record<string, unknown> {
    return this.presenter.present({
      ...resolved,
      roomId,
      version: gameStateVersion(resolved.state),
      viewerPlayerId,
    });
  }
  bind(session: WsSession, roomId: number, gameType: string): void {
    this.hub.updateMeta(session.connectionId, {
      scope: 'game',
      roomId,
      gameType,
      userId: session.user?.id ?? null,
    });
  }
  private broadcast(
    roomId: number,
    gameType: string,
    state: GameState,
    handler: GameRuntime,
    version: number,
  ): void {
    const connections = this.hub.listConnections();
    const active = new Set(
      connections.map((connection) => connection.connectionId),
    );
    for (const key of this.latestSentVersions.keys()) {
      if (!active.has(key)) this.latestSentVersions.delete(key);
    }
    const runId = state.metadata?.roomRunId ?? 0;
    for (const connection of connections) {
      const meta = connection.meta;
      if (
        meta.scope !== 'game' ||
        !Number.isSafeInteger(Number(meta.roomId)) ||
        Number(meta.roomId) !== roomId ||
        (meta.gameType && meta.gameType !== gameType)
      ) {
        continue;
      }
      const viewerCandidate = Number(meta.userId ?? 0);
      const viewerPlayerId =
        Number.isSafeInteger(viewerCandidate) && viewerCandidate > 0
          ? viewerCandidate
          : 0;
      const previous = this.latestSentVersions.get(connection.connectionId);
      if (previous?.roomId === roomId && previous.gameType === gameType) {
        if (
          runId < previous.runId ||
          (runId === previous.runId && version < previous.version)
        )
          continue;
      }
      const sent = this.hub.send(connection.connectionId, {
        type: 'game.state',
        payload: this.presenter.present({
          state,
          handler,
          roomId,
          gameType,
          version,
          viewerPlayerId,
        }),
      });
      if (!sent) continue;
      this.latestSentVersions.set(connection.connectionId, {
        roomId,
        gameType,
        runId,
        version,
      });
    }
  }

  private clearSentVersions(roomId: number, gameType: string): void {
    for (const [key, sent] of this.latestSentVersions) {
      if (sent.roomId === roomId && sent.gameType === gameType) {
        this.latestSentVersions.delete(key);
      }
    }
  }
}
