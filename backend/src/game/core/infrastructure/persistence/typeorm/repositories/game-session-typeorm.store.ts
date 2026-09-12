import { Inject, Injectable, Optional } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, type EntityManager, type Repository } from 'typeorm';
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
import type { GameState } from '../../../../application/models/game-state.model';
import {
  appendGameTimelineCommit,
  assertGameStateSize,
  createGameTimeline,
  replayTimeline,
} from '../../../../application/services/game-timeline';
import { GameSessionEntity } from '../entities/game-session.entity';
import { GameSessionEventEntity } from '../entities/game-session-event.entity';
import { GameSessionSnapshotEntity } from '../entities/game-session-snapshot.entity';

function isCurrentSession(
  row: GameSessionEntity | null,
  commit: GameStateCommit,
): boolean {
  return (
    row !== null &&
    row.version === commit.expectedVersion &&
    (commit.expectedRestoreId === undefined ||
      (row.state.metadata?.restoreId ?? null) === commit.expectedRestoreId)
  );
}

function nextSessionState(
  row: GameSessionEntity,
  commit: GameStateCommit,
): GameState & { version: number } {
  const next = structuredClone(commit.next);
  if (row.state.metadata?.restoreId) {
    next.metadata = {
      ...next.metadata,
      restoreId: row.state.metadata.restoreId,
    };
  }
  return { ...next, version: commit.expectedVersion + 1 };
}

/**
 * Production session store. Current state, events and snapshots use separate
 * tables and are committed in one transaction under the session row lock.
 */
@Injectable()
export class GameSessionTypeormStore implements GameStateStore, GameEventStore {
  private static readonly maxTimelineEvents = 10_000;
  private static readonly maxTimelineSnapshots = 1_000;
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

  async load(roomId: number, gameType: string): Promise<GameState | null> {
    this.assertKey(roomId, gameType);
    const row = await this.repository.findOne({ where: { roomId, gameType } });
    return row ? structuredClone(row.state) : null;
  }

  async restore(
    roomId: number,
    gameType: string,
    state: GameState,
  ): Promise<GameState> {
    this.assertKey(roomId, gameType);
    assertGameStateSize(state, this.snapshotPolicy.maxStateBytes);
    const restored = structuredClone(state);
    restored.metadata = { ...restored.metadata, restoreId: randomUUID() };
    assertGameStateSize(restored, this.snapshotPolicy.maxStateBytes);
    await this.repository.manager.transaction(async (manager) => {
      await this.clearTimeline(manager, roomId, gameType);
      await manager.getRepository(GameSessionEntity).save({
        roomId,
        gameType,
        version: restored.version ?? 1,
        state: restored,
      });
      const initial = createGameTimeline(restored).initial;
      await manager.getRepository(GameSessionSnapshotEntity).save({
        roomId,
        gameType,
        seq: initial.seq,
        version: initial.version,
        state: initial.state,
      });
    });
    return structuredClone(restored);
  }

  async compareAndSet(commit: GameStateCommit): Promise<GameStateCommitResult> {
    this.assertKey(commit.roomId, commit.gameType);
    assertGameStateSize(commit.next, this.snapshotPolicy.maxStateBytes);
    if (
      !Number.isSafeInteger(commit.expectedVersion) ||
      commit.expectedVersion < 1
    ) {
      throw new RangeError('Invalid game session version');
    }
    return this.repository.manager.transaction(async (manager) => {
      const repository = manager.getRepository(GameSessionEntity);
      const row = await repository.findOne({
        where: { roomId: commit.roomId, gameType: commit.gameType },
        lock: { mode: 'pessimistic_write' },
      });
      if (!row || !isCurrentSession(row, commit)) {
        return {
          committed: false,
          version: row?.version ?? 0,
          state: structuredClone(row?.state ?? commit.next),
        };
      }

      const next = nextSessionState(row, commit);
      const previousTimeline = await this.timeline(
        manager,
        commit.roomId,
        commit.gameType,
        row.state,
      );
      const timeline = appendGameTimelineCommit({
        timeline: previousTimeline,
        previous: row.state,
        next,
        pendingEvents: commit.pendingEvents,
        occurredAtMs: commit.occurredAtMs,
        snapshotPolicy: this.snapshotPolicy,
      });
      row.version = next.version;
      row.state = next;
      await repository.save(row);
      await this.persistTimelineAppend(
        manager,
        commit,
        previousTimeline,
        timeline,
      );
      return {
        committed: true,
        version: next.version,
        state: structuredClone(next),
      };
    });
  }

  async clear(roomId: number, gameType: string): Promise<void> {
    this.assertKey(roomId, gameType);
    await this.repository.manager.transaction(async (manager) => {
      await this.clearTimeline(manager, roomId, gameType);
      await manager
        .getRepository(GameSessionEntity)
        .delete({ roomId, gameType });
    });
  }

  async clearIfVersion(
    roomId: number,
    gameType: string,
    expectedVersion: number,
    expectedRestoreId?: string | null,
  ): Promise<void> {
    this.assertKey(roomId, gameType);
    if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1) {
      throw new RangeError('Invalid game session version');
    }
    await this.repository.manager.transaction(async (manager) => {
      const repository = manager.getRepository(GameSessionEntity);
      if (expectedRestoreId !== undefined) {
        const current = await repository.findOne({
          where: { roomId, gameType },
          lock: { mode: 'pessimistic_write' },
        });
        if (
          !current ||
          (current.state.metadata?.restoreId ?? null) !== expectedRestoreId
        )
          return;
      }
      const result = await repository.delete({
        roomId,
        gameType,
        version: expectedVersion,
      });
      if (result.affected) {
        await this.clearTimeline(manager, roomId, gameType);
      }
    });
  }

  async clearRoom(roomId: number): Promise<void> {
    if (!Number.isSafeInteger(roomId) || roomId <= 0) {
      throw new RangeError('Invalid room id');
    }
    await this.repository.manager.transaction(async (manager) => {
      await manager.getRepository(GameSessionEventEntity).delete({ roomId });
      await manager.getRepository(GameSessionSnapshotEntity).delete({ roomId });
      await manager.getRepository(GameSessionEntity).delete({ roomId });
    });
  }

  async listEvents(
    roomId: number,
    gameType: string,
    afterSequence = 0,
    limit = 500,
  ): Promise<GameEvent[]> {
    this.assertKey(roomId, gameType);
    if (!Number.isSafeInteger(afterSequence) || afterSequence < 0) {
      throw new RangeError('Invalid event sequence');
    }
    const rows = await this.repository.manager
      .getRepository(GameSessionEventEntity)
      .find({
        where: { roomId, gameType, seq: MoreThan(afterSequence) },
        order: { seq: 'ASC' },
        take:
          Number.isSafeInteger(limit) && limit > 0
            ? Math.min(1_000, limit)
            : 500,
      });
    return rows.map((row) => structuredClone(row.event));
  }

  async latestSnapshot(
    roomId: number,
    gameType: string,
  ): Promise<GameSnapshot | null> {
    this.assertKey(roomId, gameType);
    const row = await this.repository.manager
      .getRepository(GameSessionSnapshotEntity)
      .findOne({ where: { roomId, gameType }, order: { seq: 'DESC' } });
    return row
      ? {
          seq: row.seq,
          version: row.version,
          state: structuredClone(row.state),
        }
      : null;
  }

  async replay(
    roomId: number,
    gameType: string,
    untilSequence?: number,
  ): Promise<GameState | null> {
    this.assertKey(roomId, gameType);
    if (
      untilSequence !== undefined &&
      (!Number.isSafeInteger(untilSequence) || untilSequence < 0)
    ) {
      throw new RangeError('Invalid replay sequence');
    }
    const row = await this.repository.findOne({ where: { roomId, gameType } });
    return row
      ? replayTimeline(
          await this.timeline(
            this.repository.manager,
            roomId,
            gameType,
            row.state,
          ),
          untilSequence,
        )
      : null;
  }

  private async persistTimelineAppend(
    manager: EntityManager,
    commit: GameStateCommit,
    previousTimeline: GameTimeline,
    timeline: GameTimeline,
  ): Promise<void> {
    const previousSequence = previousTimeline.events.at(-1)?.seq ?? 0;
    const addedEvents = timeline.events.filter(
      (event) => event.seq > previousSequence,
    );
    if (addedEvents.length > 0) {
      await manager.getRepository(GameSessionEventEntity).save(
        addedEvents.map((event) =>
          Object.assign(new GameSessionEventEntity(), {
            roomId: commit.roomId,
            gameType: commit.gameType,
            seq: event.seq,
            version: event.version,
            event,
          }),
        ),
      );
    }
    const previousSnapshotSequence =
      previousTimeline.snapshots.at(-1)?.seq ?? -1;
    const addedSnapshots = timeline.snapshots.filter(
      (snapshot) => snapshot.seq > previousSnapshotSequence,
    );
    if (addedSnapshots.length > 0) {
      await manager.getRepository(GameSessionSnapshotEntity).save(
        addedSnapshots.map((snapshot) =>
          Object.assign(new GameSessionSnapshotEntity(), {
            roomId: commit.roomId,
            gameType: commit.gameType,
            seq: snapshot.seq,
            version: snapshot.version,
            state: snapshot.state,
          }),
        ),
      );
    }
  }

  private async timeline(
    manager: EntityManager,
    roomId: number,
    gameType: string,
    fallbackState: GameState,
  ): Promise<GameTimeline> {
    const [eventRows, snapshotRows] = await Promise.all([
      manager.getRepository(GameSessionEventEntity).find({
        where: { roomId, gameType },
        order: { seq: 'ASC' },
        take: GameSessionTypeormStore.maxTimelineEvents,
      }),
      manager.getRepository(GameSessionSnapshotEntity).find({
        where: { roomId, gameType },
        order: { seq: 'ASC' },
        take: GameSessionTypeormStore.maxTimelineSnapshots,
      }),
    ]);
    const snapshots = snapshotRows.map((row) => ({
      seq: row.seq,
      version: row.version,
      state: structuredClone(row.state),
    }));
    const initial = snapshots[0] ?? createGameTimeline(fallbackState).initial;
    return {
      initial,
      events: eventRows.map((row) => structuredClone(row.event)),
      snapshots: snapshots.length > 0 ? snapshots : [initial],
    };
  }

  private async clearTimeline(
    manager: EntityManager,
    roomId: number,
    gameType: string,
  ): Promise<void> {
    await manager
      .getRepository(GameSessionEventEntity)
      .delete({ roomId, gameType });
    await manager
      .getRepository(GameSessionSnapshotEntity)
      .delete({ roomId, gameType });
  }

  private assertKey(roomId: number, gameType: string): void {
    if (
      !Number.isSafeInteger(roomId) ||
      roomId <= 0 ||
      typeof gameType !== 'string' ||
      gameType.length === 0 ||
      gameType.length > 128
    ) {
      throw new RangeError('Invalid game session key');
    }
  }
}
