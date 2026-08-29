import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  DEFAULT_GAME_SNAPSHOT_POLICY,
  GAME_SNAPSHOT_POLICY,
  type GameEventStore,
  type GameSnapshotPolicy,
} from '../../../application/ports/game-event-store.port';
import type {
  GameStateCommit,
  GameStateCommitResult,
  GameStateStore,
} from '../../../application/ports/game-state-store.port';
import type {
  GameEvent,
  GameSnapshot,
  GameTimeline,
} from '../../../application/models/game-event.model';
import type { GameStateEntity } from '../../../application/models/game-state.model';
import {
  appendGameTimelineCommit,
  assertGameStateSize,
  createGameTimeline,
  replayTimeline,
} from '../../../application/services/game-event-log.helper';

@Injectable()
export class InMemoryGameSessionStore
  implements GameStateStore, GameEventStore
{
  private readonly states = new Map<string, GameStateEntity>();
  private readonly timelines = new Map<string, GameTimeline>();
  private readonly snapshotPolicy: Readonly<GameSnapshotPolicy>;

  constructor(
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
    const state = this.states.get(this.key(roomId, gameType));
    return state ? structuredClone(state) : null;
  }

  async restore(
    roomId: number,
    gameType: string,
    state: GameStateEntity,
  ): Promise<void> {
    const key = this.key(roomId, gameType);
    const restored = structuredClone(state);
    assertGameStateSize(restored, this.snapshotPolicy.maxStateBytes);
    this.states.set(key, restored);
    this.timelines.set(key, createGameTimeline(restored));
  }

  async compareAndSet(commit: GameStateCommit): Promise<GameStateCommitResult> {
    const key = this.key(commit.roomId, commit.gameType);
    const current = this.states.get(key);
    const currentVersion = current?.version ?? 0;
    if (!current || currentVersion !== commit.expectedVersion) {
      return {
        committed: false,
        version: currentVersion,
        state: structuredClone(current ?? commit.next),
      };
    }

    const next = structuredClone(commit.next);
    const committedVersion = commit.expectedVersion + 1;
    next.version = committedVersion;
    const timeline = appendGameTimelineCommit({
      timeline: this.timelineForCommit(key, current),
      previous: current,
      next,
      pendingEvents: commit.pendingEvents,
      occurredAtMs: commit.occurredAtMs,
      snapshotPolicy: this.snapshotPolicy,
    });
    this.states.set(key, next);
    this.timelines.set(key, timeline);
    return {
      committed: true,
      version: committedVersion,
      state: structuredClone(next),
    };
  }

  async clear(roomId: number, gameType: string): Promise<void> {
    const key = this.key(roomId, gameType);
    this.states.delete(key);
    this.timelines.delete(key);
  }

  async clearIfVersion(
    roomId: number,
    gameType: string,
    expectedVersion: number,
  ): Promise<void> {
    const key = this.key(roomId, gameType);
    if (this.states.get(key)?.version === expectedVersion) {
      this.states.delete(key);
      this.timelines.delete(key);
    }
  }

  async clearRoom(roomId: number): Promise<void> {
    const prefix = `${roomId}:`;
    for (const key of this.states.keys()) {
      if (!key.startsWith(prefix)) continue;
      this.states.delete(key);
      this.timelines.delete(key);
    }
  }

  async listEvents(
    roomId: number,
    gameType: string,
    afterSequence = 0,
    limit = 500,
  ): Promise<GameEvent[]> {
    return structuredClone(
      (this.timelines.get(this.key(roomId, gameType))?.events ?? [])
        .filter((event) => event.seq > afterSequence)
        .slice(0, Math.max(1, Math.min(1_000, Math.trunc(limit)))),
    );
  }

  async latestSnapshot(
    roomId: number,
    gameType: string,
  ): Promise<GameSnapshot | null> {
    const timeline = this.timelines.get(this.key(roomId, gameType));
    return timeline ? structuredClone(timeline.snapshots.at(-1) ?? null) : null;
  }

  async replay(
    roomId: number,
    gameType: string,
    untilSequence?: number,
  ): Promise<GameStateEntity | null> {
    const timeline = this.timelines.get(this.key(roomId, gameType));
    return timeline
      ? replayTimeline(structuredClone(timeline), untilSequence)
      : null;
  }

  private key(roomId: number, gameType: string): string {
    return `${roomId}:${gameType}`;
  }

  private timelineForCommit(key: string, state: GameStateEntity): GameTimeline {
    const existing = this.timelines.get(key);
    if (existing) return structuredClone(existing);
    return createGameTimeline(state);
  }
}
