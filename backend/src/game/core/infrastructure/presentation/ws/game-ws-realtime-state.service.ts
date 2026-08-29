import { Injectable, NotFoundException } from '@nestjs/common';
import { stringOrEmpty } from '@common/utils/public-api';
import type { WsSession } from '../../../../../realtime/public-api';
import { WsApiHubService } from '../../../../../common/ws/public-api';
import type { GameRuntime } from '../../../application/contracts/game-runtime.interface';
import type { GameStateEntity } from '../../../application/models/game-state.model';
import { resolveGameStateRunId } from '../../../application/helpers/game-room-run-id.helper';
import { GameRoomStateFactory } from '../../../application/services/game-room-state.factory';
import { GameEngineService } from '../../../application/services/game-engine.service';
import { GameRealtimeAutomationService } from '../../../application/services/game-realtime-automation.service';
import { GameRegistryService } from '../../../application/services/game-registry.service';
import { GameWsRoomContextService } from './game-ws-room-context.service';
import { GameWsStatePresenter } from './game-ws-state.presenter';
import { GameStateConflictError } from '../../../domain/errors/game-domain.errors';
import { GameExecutionScopeService } from '../../../application/services/game-execution-scope.service';

type VersionedGameState = GameStateEntity & { version?: number };

export type ResolvedGameState = {
  gameType: string;
  state: GameStateEntity;
  handler: GameRuntime;
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
  ) {}

  async resolve(roomId: number): Promise<ResolvedGameState> {
    const room = await this.rooms.buildPayload(roomId);
    const gameType = stringOrEmpty(room.room.gameType).trim();
    const handler = this.registry.getHandler(gameType);
    if (!handler) throw new NotFoundException(`Jeu introuvable: ${gameType}`);

    const existing = await this.engine.exportInternalState(roomId, gameType);
    if (existing && this.belongsToCurrentRun(existing, room.room)) {
      this.ensureVersion(existing);
      return { gameType, state: existing, handler };
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
    this.broadcast(
      roomId,
      resolved.gameType,
      result.state,
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
}
