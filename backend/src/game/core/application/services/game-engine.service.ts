import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { GameState } from '../models/game-state.model';
import { assertSerializableState } from '../../../engine/runtime/state/assert-serializable-state';
import type {
  GameEvent,
  GameSnapshot,
  ProjectedGameEvent,
} from '../models/game-event.model';
import { SystemGameClock } from '@platform/time/public-api';
import { drainPendingGameEvents } from './game-event-buffer';
import {
  GAME_STATE_STORE,
  type GameStateStore,
} from '../ports/game-state-store.port';
import {
  GAME_EVENT_STORE,
  type GameEventStore,
} from '../ports/game-event-store.port';
import { projectGameEvent } from './game-event-visibility';
import { GameEngineMetricsService } from './game-engine-metrics.service';
import { asGameId, asRoomId } from '../../../../shared/interfaces/public-api';

@Injectable()
export class GameEngineService {
  private readonly clock = new SystemGameClock();
  private readonly logger = new Logger(GameEngineService.name);

  constructor(
    @Inject(GAME_STATE_STORE)
    private readonly states: GameStateStore,
    @Inject(GAME_EVENT_STORE)
    private readonly events: GameEventStore,
    @Optional() private readonly metrics?: GameEngineMetricsService,
  ) {}

  async exportInternalState(
    roomId: number,
    gameType: string,
  ): Promise<GameState | null> {
    return this.states.load(asRoomId(roomId), asGameId(gameType));
  }

  async restoreInternalState(
    roomId: number,
    gameType: string,
    state: GameState,
  ): Promise<void> {
    const typedRoomId = asRoomId(roomId);
    const typedGameId = asGameId(gameType);
    try {
      assertSerializableState(state);
      this.ensureVersion(state);
      const restored = this.clone(state);
      drainPendingGameEvents(restored);
      const persisted = await this.states.restore(
        typedRoomId,
        typedGameId,
        restored,
      );
      state.metadata = {
        ...state.metadata,
        restoreId: persisted.metadata?.restoreId,
      };
    } catch (error) {
      this.metrics?.recordFailure(gameType, 'restore', error);
      throw error;
    }
  }

  async compareAndSetInternalState(
    roomId: number,
    gameType: string,
    expectedVersion: number,
    next: GameState,
    expectedRestoreId?: string | null,
  ): Promise<{ committed: boolean; version: number; state: GameState }> {
    if (
      !Number.isSafeInteger(roomId) ||
      roomId <= 0 ||
      !gameType.trim() ||
      gameType.length > 128 ||
      !Number.isSafeInteger(expectedVersion) ||
      expectedVersion <= 0
    ) {
      throw new RangeError('Paramètres de version de jeu invalides');
    }
    const typedRoomId = asRoomId(roomId);
    const typedGameId = asGameId(gameType);
    const committed = this.clone(next);
    committed.version = expectedVersion + 1;
    const pendingEvents = drainPendingGameEvents(committed);
    const result = await this.states
      .compareAndSet({
        roomId: typedRoomId,
        gameType: typedGameId,
        expectedVersion,
        expectedRestoreId,
        next: committed,
        pendingEvents,
        occurredAtMs: this.clock.nowMs(),
      })
      .catch((error: unknown) => {
        this.metrics?.recordFailure(gameType, 'commit', error);
        throw error;
      });
    this.metrics?.recordCommit(
      gameType,
      result.committed,
      Buffer.byteLength(JSON.stringify(result.state), 'utf8'),
    );
    this.logger.log(
      JSON.stringify({
        event: result.committed
          ? 'game.state.committed'
          : 'game.state.conflict',
        roomId,
        gameType,
        commandId:
          [...pendingEvents]
            .reverse()
            .map((event) => event.data.commandId)
            .find((value) => typeof value === 'string') ?? null,
        expectedVersion,
        resultVersion: result.version,
        stateBytes: Buffer.byteLength(JSON.stringify(result.state), 'utf8'),
      }),
    );
    return result;
  }

  async clearInternalState(roomId: number, gameType: string): Promise<void> {
    await this.states.clear(asRoomId(roomId), asGameId(gameType));
  }

  async clearInternalStateIf(
    roomId: number,
    gameType: string,
    expected: GameState,
  ): Promise<void> {
    await this.states.clearIfVersion(
      asRoomId(roomId),
      asGameId(gameType),
      this.ensureVersion(expected),
      expected.metadata?.restoreId ?? null,
    );
  }

  async clearRoom(roomId: number): Promise<void> {
    await this.states.clearRoom(asRoomId(roomId));
  }

  async listEvents(
    roomId: number,
    gameType: string,
    afterSequence = 0,
    limit = 500,
  ): Promise<GameEvent[]> {
    return this.events.listEvents(
      asRoomId(roomId),
      asGameId(gameType),
      afterSequence,
      limit,
    );
  }

  async listEventsForPlayer(
    roomId: number,
    gameType: string,
    viewerPlayerId: number | null,
    afterSequence = 0,
    limit = 500,
  ): Promise<ProjectedGameEvent[]> {
    const events = await this.listEvents(
      roomId,
      gameType,
      afterSequence,
      limit,
    );
    return events.flatMap((event) => {
      const projected = projectGameEvent(event, viewerPlayerId);
      return projected ? [projected] : [];
    });
  }

  async exportLatestSnapshot(
    roomId: number,
    gameType: string,
  ): Promise<GameSnapshot | null> {
    try {
      return await this.events.latestSnapshot(
        asRoomId(roomId),
        asGameId(gameType),
      );
    } catch (error) {
      this.metrics?.recordFailure(gameType, 'snapshot', error);
      throw error;
    }
  }

  async replay(
    roomId: number,
    gameType: string,
    untilSequence?: number,
  ): Promise<GameState | null> {
    try {
      return await this.events.replay(
        asRoomId(roomId),
        asGameId(gameType),
        untilSequence,
      );
    } catch (error) {
      this.metrics?.recordFailure(gameType, 'replay', error);
      throw error;
    }
  }

  private ensureVersion(state: GameState): number {
    const version = Number(state.version);
    if (Number.isSafeInteger(version) && version > 0) return version;
    state.version = 1;
    return 1;
  }

  private clone(state: GameState): GameState {
    assertSerializableState(state);
    return structuredClone(state);
  }
}
