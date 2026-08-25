import { Injectable, NotFoundException } from '@nestjs/common';
import type { WsSession } from '../../../../../realtime/public-api';
import { WsApiHubService } from '../../../../../common/ws/public-api';
import type { GameRulesAdapter } from '../../../application/contracts/game-rules-adapter.interface';
import type { GameStateEntity } from '../../../application/models/game-state.model';
import { GameCoreService } from '../../../application/services/game-core.service';
import { GameEngineService } from '../../../application/services/game-engine.service';
import { GameRealtimeAutomationService } from '../../../application/services/game-realtime-automation.service';
import { GameRegistryService } from '../../../application/services/game-registry.service';
import { GameWsRoomContextService } from './game-ws-room-context.service';
import { GameWsStatePresenter } from './game-ws-state.presenter';

type VersionedGameState = GameStateEntity & { version?: number };

export type ResolvedGameState = {
  gameType: string;
  state: GameStateEntity;
  handler: GameRulesAdapter;
};

@Injectable()
export class GameWsRealtimeStateService {
  constructor(
    private readonly core: GameCoreService,
    private readonly engine: GameEngineService,
    private readonly registry: GameRegistryService,
    private readonly automation: GameRealtimeAutomationService,
    private readonly presenter: GameWsStatePresenter,
    private readonly hub: WsApiHubService,
    private readonly rooms: GameWsRoomContextService,
  ) {}

  async resolve(roomId: number): Promise<ResolvedGameState> {
    const room = await this.rooms.buildPayload(roomId);
    const gameType = String(room.room.gameType ?? '').trim();
    const handler = this.registry.getHandler(gameType);
    if (!handler) throw new NotFoundException(`Jeu introuvable: ${gameType}`);

    const existing = await this.engine.exportInternalState(roomId, gameType);
    if (existing && this.belongsToCurrentRun(existing, room.room)) {
      this.ensureVersion(existing);
      return { gameType, state: existing, handler };
    }
    if (existing) await this.clear(roomId, gameType);

    const baseState = this.core.buildBaseState(room, gameType);
    const state = handler.hydrateInitialState(baseState);
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
      commit: (previous, next) => this.commit(roomId, resolved, previous, next),
    });
  }

  async commit(
    roomId: number,
    resolved: ResolvedGameState,
    previous: GameStateEntity,
    next: GameStateEntity,
  ): Promise<void> {
    this.preserveRoomRunId(previous, next);
    const version = this.bumpVersion(next, previous);
    await this.engine.restoreInternalState(roomId, resolved.gameType, next);
    this.broadcast(roomId, resolved.gameType, next, resolved.handler, version);
    this.schedule(roomId, { ...resolved, state: next });
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
    if (String(room.status ?? '').toLowerCase() !== 'started') return false;
    const stateRunId = (state.metadata as Record<string, unknown> | undefined)
      ?.roomRunId;
    return (
      typeof stateRunId === 'number' &&
      typeof room.runId === 'number' &&
      stateRunId === room.runId
    );
  }

  private preserveRoomRunId(
    source: GameStateEntity,
    target: GameStateEntity,
  ): void {
    const sourceMetadata =
      source.metadata && typeof source.metadata === 'object'
        ? (source.metadata as Record<string, unknown>)
        : {};
    const roomRunId = sourceMetadata.roomRunId;
    if (typeof roomRunId !== 'number') return;

    const targetMetadata =
      target.metadata && typeof target.metadata === 'object'
        ? (target.metadata as Record<string, unknown>)
        : {};
    target.metadata = { ...targetMetadata, roomRunId };
  }

  private ensureVersion(state: GameStateEntity): number {
    const versioned = state as VersionedGameState;
    const current = Number(versioned.version);
    if (Number.isFinite(current) && current > 0) return current;
    versioned.version = 1;
    return 1;
  }

  private bumpVersion(
    next: GameStateEntity,
    previous: GameStateEntity,
  ): number {
    const nextVersion = this.ensureVersion(previous) + 1;
    (next as VersionedGameState).version = nextVersion;
    return nextVersion;
  }

  private broadcast(
    roomId: number,
    gameType: string,
    state: GameStateEntity,
    handler: GameRulesAdapter,
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
