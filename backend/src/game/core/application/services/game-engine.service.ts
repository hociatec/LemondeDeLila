import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { GameStateEntity } from '../contracts/game-state.model';
import type {
  GameEvent,
  GameSnapshot,
  ProjectedGameEvent,
} from '../contracts/game-event.model';
import { SystemGameClock } from '../contracts/game-execution-context.model';
import { drainPendingGameEvents } from './game-event-log.helper';
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
  ): Promise<GameStateEntity | null> {
    return this.states.load(roomId, gameType);
  }

  async restoreInternalState(
    roomId: number,
    gameType: string,
    state: GameStateEntity,
  ): Promise<void> {
    this.ensureVersion(state);
    const restored = this.clone(state);
    drainPendingGameEvents(restored);
    await this.states.restore(roomId, gameType, restored);
  }

  async compareAndSetInternalState(
    roomId: number,
    gameType: string,
    expectedVersion: number,
    next: GameStateEntity,
  ): Promise<{ committed: boolean; version: number; state: GameStateEntity }> {
    const committed = this.clone(next);
    committed.version = expectedVersion + 1;
    const pendingEvents = drainPendingGameEvents(committed);
    const result = await this.states.compareAndSet({
      roomId,
      gameType,
      expectedVersion,
      next: committed,
      pendingEvents,
      occurredAtMs: this.clock.nowMs(),
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
    await this.states.clear(roomId, gameType);
  }

  async clearInternalStateIf(
    roomId: number,
    gameType: string,
    expected: GameStateEntity,
  ): Promise<void> {
    await this.states.clearIfVersion(
      roomId,
      gameType,
      this.ensureVersion(expected),
    );
  }

  async clearRoom(roomId: number): Promise<void> {
    await this.states.clearRoom(roomId);
  }

  async listEvents(
    roomId: number,
    gameType: string,
    afterSequence = 0,
    limit = 500,
  ): Promise<GameEvent[]> {
    return this.events.listEvents(roomId, gameType, afterSequence, limit);
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
    return this.events.latestSnapshot(roomId, gameType);
  }

  async replay(
    roomId: number,
    gameType: string,
    untilSequence?: number,
  ): Promise<GameStateEntity | null> {
    return this.events.replay(roomId, gameType, untilSequence);
  }

  private ensureVersion(state: GameStateEntity): number {
    const version = Number(state.version);
    if (Number.isInteger(version) && version > 0) return version;
    state.version = 1;
    return 1;
  }

  private clone(state: GameStateEntity): GameStateEntity {
    return structuredClone(state);
  }
}
