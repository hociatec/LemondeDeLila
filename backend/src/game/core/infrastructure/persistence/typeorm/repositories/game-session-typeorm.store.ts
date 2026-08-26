import { Inject, Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import {
  DEFAULT_GAME_SNAPSHOT_POLICY,
  GAME_SNAPSHOT_POLICY,
  type GameEventStore,
  type GameSnapshotPolicy,
} from '../../../../application/ports/game-event-store.port';
import type {
  GameStateCommit,
  GameStateCommitResult,
  GameStateStore,
} from '../../../../application/ports/game-state-store.port';
import type {
  GameEvent,
  GameSnapshot,
  GameTimeline,
} from '../../../../application/models/game-event.model';
import type { GameStateEntity } from '../../../../application/models/game-state.model';
import {
  appendGameTimelineCommit,
  assertGameStateSize,
  createGameTimeline,
  replayTimeline,
} from '../../../../application/services/game-event-log.helper';
import { GameSessionEntity } from '../entities/game-session.entity';

/**
 * Production session store. State, events and snapshots live in the same row
 * and are replaced under a database write lock, making a command commit one
 * atomic unit across application instances.
 */
@Injectable()
export class GameSessionTypeormStore implements GameStateStore, GameEventStore {
  private readonly snapshotPolicy: Readonly<GameSnapshotPolicy>;

  constructor(
    @InjectRepository(GameSessionEntity)
    private readonly repository: Repository<GameSessionEntity>,
    @Optional()
    @Inject(GAME_SNAPSHOT_POLICY)
    policy?: GameSnapshotPolicy,
  ) {
    this.snapshotPolicy = {
      ...DEFAULT_GAME_SNAPSHOT_POLICY,
      ...policy,
    };
  }

  async load(
    roomId: number,
    gameType: string,
  ): Promise<GameStateEntity | null> {
    const row = await this.repository.findOne({ where: { roomId, gameType } });
    return row ? structuredClone(row.state) : null;
  }

  async restore(
    roomId: number,
    gameType: string,
    state: GameStateEntity,
  ): Promise<void> {
    const restored = structuredClone(state);
    assertGameStateSize(restored, this.snapshotPolicy.maxStateBytes);
    await this.repository.save(
      this.repository.create({
        roomId,
        gameType,
        version: restored.version ?? 1,
        state: restored,
        timeline: createGameTimeline(restored),
      }),
    );
  }

  async compareAndSet(
    commit: GameStateCommit,
  ): Promise<GameStateCommitResult> {
    return this.repository.manager.transaction(async (manager) => {
      const repository = manager.getRepository(GameSessionEntity);
      const row = await repository.findOne({
        where: { roomId: commit.roomId, gameType: commit.gameType },
        lock: { mode: 'pessimistic_write' },
      });
      if (!row || row.version !== commit.expectedVersion) {
        return {
          committed: false,
          version: row?.version ?? 0,
          state: structuredClone(row?.state ?? commit.next),
        };
      }

      const next = structuredClone(commit.next);
      next.version = commit.expectedVersion + 1;
      const timeline = appendGameTimelineCommit({
        timeline: this.timeline(row),
        previous: row.state,
        next,
        pendingEvents: commit.pendingEvents,
        occurredAtMs: commit.occurredAtMs,
        snapshotPolicy: this.snapshotPolicy,
      });
      row.version = next.version;
      row.state = next;
      row.timeline = timeline;
      await repository.save(row);
      return {
        committed: true,
        version: next.version,
        state: structuredClone(next),
      };
    });
  }

  async clear(roomId: number, gameType: string): Promise<void> {
    await this.repository.delete({ roomId, gameType });
  }

  async clearIfVersion(
    roomId: number,
    gameType: string,
    expectedVersion: number,
  ): Promise<void> {
    await this.repository.delete({ roomId, gameType, version: expectedVersion });
  }

  async clearRoom(roomId: number): Promise<void> {
    await this.repository.delete({ roomId });
  }

  async listEvents(
    roomId: number,
    gameType: string,
    afterSequence = 0,
  ): Promise<GameEvent[]> {
    const row = await this.repository.findOne({ where: { roomId, gameType } });
    return row
      ? structuredClone(
          this.timeline(row).events.filter(
            (event) => event.seq > afterSequence,
          ),
        )
      : [];
  }

  async latestSnapshot(
    roomId: number,
    gameType: string,
  ): Promise<GameSnapshot | null> {
    const row = await this.repository.findOne({ where: { roomId, gameType } });
    return row
      ? structuredClone(this.timeline(row).snapshots.at(-1) ?? null)
      : null;
  }

  async replay(
    roomId: number,
    gameType: string,
    untilSequence?: number,
  ): Promise<GameStateEntity | null> {
    const row = await this.repository.findOne({ where: { roomId, gameType } });
    return row
      ? replayTimeline(structuredClone(this.timeline(row)), untilSequence)
      : null;
  }

  private timeline(row: GameSessionEntity): GameTimeline {
    const timeline = row.timeline;
    return timeline &&
      typeof timeline === 'object' &&
      Array.isArray(timeline.events) &&
      Array.isArray(timeline.snapshots)
      ? timeline
      : createGameTimeline(row.state);
  }
}
