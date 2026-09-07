import { Injectable, NotFoundException } from '@nestjs/common';
import { stringOrEmpty } from '@shared/utils/public-api';
import type { WsSession } from '../../../../../../platform/realtime/public-api';
import { WsApiHubService } from '../../../../../../platform/ws/public-api';
import type { GameRuntime } from '../../../../application/contracts/game-runtime.interface';
import type { GameStateEntity } from '../../../../application/contracts/game-state.model';
import { resolveGameStateRunId } from '../../../../application/helpers/game-room-run-id.helper';
import { GameRoomStateFactory } from '../../../../application/services/game-room-state.factory';
import { GameEngineService } from '../../../../application/services/game-engine.service';
import { GameRealtimeAutomationService } from '../../../../application/services/game-realtime-automation.service';
import { GameRegistryService } from '../../../../application/services/game-registry.service';
import { GameWsRoomContextService } from '../game-ws-room-context.service';
import { GameWsStatePresenter } from './game-ws-state.presenter';
import { GameStateConflictError } from '../../../../domain/errors/game-domain.errors';
import { GameExecutionScopeService } from '../../../../application/services/game-execution-scope.service';

type VersionedGameState = GameStateEntity & { version?: number };

export type ResolvedGameState = {
  gameType: string;
  state: GameStateEntity;
  handler: GameRuntime;
  setupRosterRefreshedFromVersion?: number;
};

@Injectable()
export class GameWsRealtimeStateService {
  constructor(
    private readonly stateFactory: GameRoomStateFactory,
    private readonly engine: GameEngineService,
    private readonly registry: GameRegistryService,
    private readonly automation: GameRealtimeAutomationService,
    private readonly presenter: GameWsStatePresenter,
    private readonly hub: WsApiHubService,
    private readonly rooms: GameWsRoomContextService,
    private readonly execution: GameExecutionScopeService,
  ) {
    this.automation.setStateCommittedHandler?.(async (committed) => {
      await this.publishCommittedState(
        committed.roomId,
        committed.gameType,
        committed.state,
        committed.handler,
        committed.version,
      );
    });
  }

  async resolve(roomId: number): Promise<ResolvedGameState> {
    const room = await this.rooms.buildPayload(roomId);
    const gameType = stringOrEmpty(room.room.gameType).trim();
    const handler = this.registry.getHandler(gameType);
    if (!handler) throw new NotFoundException(`Jeu introuvable: ${gameType}`);

    const existing = await this.engine.exportInternalState(roomId, gameType);
    if (existing && this.belongsToCurrentRun(existing, room.room)) {
      this.ensureVersion(existing);
      const refreshed = await this.refreshSetupRoster(
        roomId,
        gameType,
        existing,
        room,
        handler,
      );
      return { gameType, handler, ...refreshed };
    }
    if (existing) await this.clear(roomId, gameType);

    const baseState = this.stateFactory.build(room, gameType);
    const context = this.execution.create(baseState, null);
    const state = this.execution.run(context, () =>
      handler.hydrateInitialState(baseState, context),
    );
    this.preserveRoomRunId(baseState, state);
    this.ensureVersion(state);
    await this.engine.restoreInternalState(roomId, gameType, state);
    return { gameType, state, handler };
  }

  present(
    resolved: ResolvedGameState,
    roomId: number,
    viewerPlayerId: number,
  ): Record<string, unknown> {
    return this.presenter.present({
      ...resolved,
      roomId,
      version: this.ensureVersion(resolved.state),
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

  schedule(roomId: number, resolved: ResolvedGameState): void {
    const { gameType, state, handler } = resolved;
    this.automation.schedule({
      roomId,
      gameType,
      handler,
      state,
    });
  }

  async commit(
    roomId: number,
    resolved: ResolvedGameState,
    previous: GameStateEntity,
    next: GameStateEntity,
  ): Promise<void> {
    this.preserveRoomRunId(previous, next);
    const expectedVersion = this.ensureVersion(previous);
    const result = await this.engine.compareAndSetInternalState(
      roomId,
      resolved.gameType,
      expectedVersion,
      next,
    );
    if (!result.committed) throw new GameStateConflictError();
    // The store drains transient domain events before persistence. Broadcast
    // the command result so clients receive its draw/play/turn announcements,
    // while automation continues from the clean persisted state.
    const presentedState = structuredClone(next);
    presentedState.version = result.version;
    await this.publishCommittedState(
      roomId,
      resolved.gameType,
      presentedState,
      resolved.handler,
      result.version,
    );
    this.schedule(roomId, { ...resolved, state: result.state });
  }

  async clear(roomId: number, gameType: string): Promise<void> {
    this.automation.clear(roomId, gameType);
    await this.engine.clearInternalState(roomId, gameType);
  }

  async clearRoom(roomId: number): Promise<void> {
    this.automation.clearRoom(roomId);
    await this.engine.clearRoom(roomId);
  }

  private belongsToCurrentRun(
    state: GameStateEntity,
    room: { status?: unknown; runId?: unknown },
  ): boolean {
    const stateRunId = state.metadata?.roomRunId;
    const expectedRunId = resolveGameStateRunId(room);
    return (
      typeof stateRunId === 'number' &&
      expectedRunId != null &&
      stateRunId === expectedRunId
    );
  }

  private preserveRoomRunId(
    source: GameStateEntity,
    target: GameStateEntity,
  ): void {
    const roomRunId = source.metadata?.roomRunId;
    if (typeof roomRunId !== 'number') return;

    target.metadata = { ...(target.metadata ?? {}), roomRunId };
  }

  private async refreshSetupRoster(
    roomId: number,
    gameType: string,
    existing: GameStateEntity,
    room: Parameters<GameRoomStateFactory['build']>[0],
    handler: GameRuntime,
  ): Promise<{
    state: GameStateEntity;
    setupRosterRefreshedFromVersion?: number;
  }> {
    const roomStatus = stringOrEmpty(room.room.status).toLowerCase();
    if (
      (roomStatus !== 'setup' && roomStatus !== 'started') ||
      stringOrEmpty(existing.status).toLowerCase() !== 'setup' ||
      stringOrEmpty(existing.phase).toLowerCase() !== 'setup'
    ) {
      return { state: existing };
    }
    const base = this.stateFactory.build(room, gameType);
    if (this.sameRoster(existing.players ?? [], base.players ?? [])) {
      return { state: existing };
    }
    const context = this.execution.create(base, null);
    const refreshed = this.execution.run(context, () =>
      handler.hydrateInitialState(base, context),
    );
    this.preserveRoomRunId(existing, refreshed);
    const result = await this.engine.compareAndSetInternalState(
      roomId,
      gameType,
      this.ensureVersion(existing),
      refreshed,
    );
    return result.committed
      ? {
          state: result.state,
          setupRosterRefreshedFromVersion: this.ensureVersion(existing),
        }
      : { state: result.state };
  }

  private sameRoster(
    left: NonNullable<GameStateEntity['players']>,
    right: NonNullable<GameStateEntity['players']>,
  ): boolean {
    return (
      left.length === right.length &&
      left.every((player, index) => {
        const candidate = right[index];
        return (
          candidate != null &&
          player.id === candidate.id &&
          player.username === candidate.username &&
          Boolean(player.isBot) === Boolean(candidate.isBot)
        );
      })
    );
  }

  private ensureVersion(state: GameStateEntity): number {
    const versioned = state as VersionedGameState;
    const current = Number(versioned.version);
    if (Number.isFinite(current) && current > 0) return current;
    versioned.version = 1;
    return 1;
  }

  private broadcast(
    roomId: number,
    gameType: string,
    state: GameStateEntity,
    handler: GameRuntime,
    version: number,
  ): void {
    for (const connection of this.hub.listConnections()) {
      const meta = connection.meta;
      if (
        meta.scope !== 'game' ||
        Number(meta.roomId) !== roomId ||
        (meta.gameType && meta.gameType !== gameType)
      ) {
        continue;
      }
      const viewerPlayerId = Number(meta.userId ?? 0);
      this.hub.send(connection.connectionId, {
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
    }
  }

  private async publishCommittedState(
    roomId: number,
    gameType: string,
    state: GameStateEntity,
    handler: GameRuntime,
    version: number,
  ): Promise<void> {
    this.broadcast(roomId, gameType, state, handler, version);
    if (stringOrEmpty(state.status).toLowerCase() === 'finished') {
      await this.rooms.prepareNextRun(roomId);
    }
  }
}
