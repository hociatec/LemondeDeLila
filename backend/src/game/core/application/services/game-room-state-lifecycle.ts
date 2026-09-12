import { stringOrEmpty } from '@shared/utils/public-api';
import type { GameRuntime } from '../ports/game-runtime.port';
import type { GameState } from '../models/game-state.model';
import type { GameRoomPayload } from '../ports/game-room.port';
import { resolveGameStateRunId } from '../helpers/game-room-run-id.helper';
import type { GameRoomStateFactory } from './game-room-state.factory';
import type { GameEngineService } from './game-engine.service';
import type { GameRealtimeAutomationService } from './game-realtime-automation.service';
import type { GameRegistryService } from './game-registry.service';
import type { GameExecutionScopeService } from './game-execution-scope.service';
import {
  GameNotFoundError,
  GameStateConflictError,
} from '../../domain/errors/game-domain.errors';

type VersionedGameState = GameState & { version?: number };
export type ResolvedGameState = {
  gameType: string;
  state: GameState;
  handler: GameRuntime;
  commandRebaseFromVersion?: number;
};
export interface GameRoomStateContext {
  buildPayload(roomId: number): Promise<GameRoomPayload>;
  refreshPayload(roomId: number): Promise<GameRoomPayload>;
  prepareNextRun(roomId: number): Promise<void>;
}
export type GameStatePublisher = (
  roomId: number,
  gameType: string,
  state: GameState,
  handler: GameRuntime,
  version: number,
) => void;

/** Coordinates run isolation, roster refresh and committed state, without transport. */
export class GameRoomStateLifecycle {
  constructor(
    private readonly stateFactory: GameRoomStateFactory,
    private readonly engine: GameEngineService,
    private readonly registry: GameRegistryService,
    private readonly automation: GameRealtimeAutomationService,
    private readonly rooms: GameRoomStateContext,
    private readonly execution: GameExecutionScopeService,
    private readonly publish: GameStatePublisher,
  ) {}
  async resolve(roomId: number): Promise<ResolvedGameState> {
    const cachedRoom = await this.rooms.buildPayload(roomId);
    const gameType = stringOrEmpty(cachedRoom.room.gameType).trim();
    const handler = this.registry.getHandler(gameType);
    if (!handler) throw new GameNotFoundError(`Jeu introuvable: ${gameType}`);

    const existing = await this.engine.exportInternalState(roomId, gameType);
    // A cached lobby payload is sufficient during ordinary turns, but never
    // for creating or reconfiguring a game roster. Bot/human mutations and a
    // start command can be handled concurrently by separate WS connections.
    // Reading the relations from the database closes that last race even when
    // the cache itself is new.
    const room =
      !existing ||
      !this.belongsToCurrentRun(existing, cachedRoom.room) ||
      this.isRosterConfigurationState(existing)
        ? await this.rooms.refreshPayload(roomId)
        : cachedRoom;
    if (existing && this.belongsToCurrentRun(existing, room.room)) {
      this.ensureVersion(existing);
      const refreshed = await this.refreshSetupRoster(
        roomId,
        gameType,
        existing,
        room,
        handler,
      );
      const started = await this.refreshRoomStartedAt(
        roomId,
        gameType,
        refreshed.state,
        room.room.startedAt,
      );
      return {
        gameType,
        handler,
        state: started.state,
        commandRebaseFromVersion:
          refreshed.commandRebaseFromVersion ??
          started.commandRebaseFromVersion,
      };
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
    previous: GameState,
    next: GameState,
  ): Promise<void> {
    this.preserveRoomRunId(previous, next);
    const expectedVersion = this.ensureVersion(previous);
    const result = await this.engine.compareAndSetInternalState(
      roomId,
      resolved.gameType,
      expectedVersion,
      next,
      previous.metadata?.restoreId ?? null,
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
    state: GameState,
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

  private preserveRoomRunId(source: GameState, target: GameState): void {
    const roomRunId = source.metadata?.roomRunId;
    if (typeof roomRunId !== 'number') return;

    target.metadata = { ...(target.metadata ?? {}), roomRunId };
  }

  private async refreshRoomStartedAt(
    roomId: number,
    gameType: string,
    existing: GameState,
    roomStartedAt: Date | string | null | undefined,
  ): Promise<{
    state: GameState;
    commandRebaseFromVersion?: number;
  }> {
    if (existing.metadata?.roomStartedAt != null || roomStartedAt == null) {
      return { state: existing };
    }
    const normalizedStartedAt =
      roomStartedAt instanceof Date
        ? roomStartedAt.toISOString()
        : roomStartedAt;
    const next = structuredClone(existing);
    next.metadata = {
      ...(next.metadata ?? {}),
      roomStartedAt: normalizedStartedAt,
    };
    const result = await this.engine.compareAndSetInternalState(
      roomId,
      gameType,
      this.ensureVersion(existing),
      next,
      existing.metadata?.restoreId ?? null,
    );
    return result.committed
      ? {
          state: result.state,
          commandRebaseFromVersion: this.ensureVersion(existing),
        }
      : { state: result.state };
  }

  private async refreshSetupRoster(
    roomId: number,
    gameType: string,
    existing: GameState,
    room: Parameters<GameRoomStateFactory['build']>[0],
    handler: GameRuntime,
  ): Promise<{
    state: GameState;
    commandRebaseFromVersion?: number;
  }> {
    const roomStatus = stringOrEmpty(room.room.status).toLowerCase();
    if (
      (roomStatus !== 'setup' && roomStatus !== 'started') ||
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
      existing.metadata?.restoreId ?? null,
    );
    return result.committed
      ? {
          state: result.state,
          commandRebaseFromVersion: this.ensureVersion(existing),
        }
      : { state: result.state };
  }

  private sameRoster(
    left: NonNullable<GameState['players']>,
    right: NonNullable<GameState['players']>,
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

  private isRosterConfigurationState(state: GameState): boolean {
    // Declarative games start the match lifecycle before asynchronous setup
    // choices (pawns, roles, etc.) have finished. Their public status is thus
    // already "playing" while the phase remains "setup".
    return stringOrEmpty(state.phase).toLowerCase() === 'setup';
  }

  private ensureVersion(state: GameState): number {
    const versioned = state as VersionedGameState;
    const current = Number(versioned.version);
    if (Number.isSafeInteger(current) && current > 0) return current;
    versioned.version = 1;
    return 1;
  }

  async publishCommittedState(
    roomId: number,
    gameType: string,
    state: GameState,
    handler: GameRuntime,
    version: number,
  ): Promise<void> {
    this.publish(roomId, gameType, state, handler, version);
    if (stringOrEmpty(state.status).toLowerCase() === 'finished') {
      await this.rooms.prepareNextRun(roomId);
    }
  }
}
