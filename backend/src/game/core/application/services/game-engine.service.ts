import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../models/game-state.model';
import type {
  GameEvent,
  GameSnapshot,
  GameTimeline,
} from '../models/game-event.model';
import { SystemGameClock } from '../models/game-execution-context.model';
import {
  createStatePatch,
  drainPendingGameEvents,
  replayTimeline,
  sequenceEvents,
} from './game-event-log.helper';

const SNAPSHOT_INTERVAL = 25;

@Injectable()
export class GameEngineService {
  private readonly states = new Map<string, GameStateEntity>();
  private readonly timelines = new Map<string, GameTimeline>();
  private readonly clock = new SystemGameClock();

  async exportInternalState(
    roomId: number,
    gameType: string,
  ): Promise<GameStateEntity | null> {
    const state = this.states.get(this.key(roomId, gameType));
    return state ? this.clone(state) : null;
  }

  async restoreInternalState(
    roomId: number,
    gameType: string,
    state: GameStateEntity,
  ): Promise<void> {
    this.ensureVersion(state);
    const key = this.key(roomId, gameType);
    const restored = this.clone(state);
    drainPendingGameEvents(restored);
    this.states.set(key, restored);
    const initial = this.snapshot(restored, 0);
    this.timelines.set(key, {
      initial,
      events: [],
      snapshots: [initial],
    });
  }

  async compareAndSetInternalState(
    roomId: number,
    gameType: string,
    expectedVersion: number,
    next: GameStateEntity,
  ): Promise<{ committed: boolean; version: number; state: GameStateEntity }> {
    const key = this.key(roomId, gameType);
    const current = this.states.get(key);
    const currentVersion = current ? this.ensureVersion(current) : 0;
    if (!current || currentVersion !== expectedVersion) {
      return {
        committed: false,
        version: currentVersion,
        state: current ? this.clone(current) : this.clone(next),
      };
    }

    const committedVersion = expectedVersion + 1;
    next.version = committedVersion;
    const committed = this.clone(next);
    const pending = drainPendingGameEvents(committed);
    const timeline = this.ensureTimeline(key, current);
    const events = sequenceEvents({
      pending,
      patch: createStatePatch(current, committed),
      previousSequence: timeline.events.at(-1)?.seq ?? 0,
      version: committedVersion,
      fallbackTimeMs: this.clock.nowMs(),
    });
    timeline.events.push(...events);
    this.capturePeriodicSnapshot(timeline, committed);
    this.states.set(key, committed);
    return {
      committed: true,
      version: committed.version ?? expectedVersion + 1,
      state: this.clone(committed),
    };
  }

  async clearInternalState(roomId: number, gameType: string): Promise<void> {
    const key = this.key(roomId, gameType);
    this.states.delete(key);
    this.timelines.delete(key);
  }

  async clearInternalStateIf(
    roomId: number,
    gameType: string,
    expected: GameStateEntity,
  ): Promise<void> {
    const key = this.key(roomId, gameType);
    const current = this.states.get(key);
    if (
      current &&
      this.ensureVersion(current) === this.ensureVersion(expected)
    ) {
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

  listEvents(roomId: number, gameType: string, afterSequence = 0): GameEvent[] {
    return structuredClone(
      (this.timelines.get(this.key(roomId, gameType))?.events ?? []).filter(
        (event) => event.seq > afterSequence,
      ),
    );
  }

  exportLatestSnapshot(roomId: number, gameType: string): GameSnapshot | null {
    const timeline = this.timelines.get(this.key(roomId, gameType));
    return timeline ? structuredClone(timeline.snapshots.at(-1) ?? null) : null;
  }

  replay(
    roomId: number,
    gameType: string,
    untilSequence?: number,
  ): GameStateEntity | null {
    const timeline = this.timelines.get(this.key(roomId, gameType));
    return timeline
      ? replayTimeline(structuredClone(timeline), untilSequence)
      : null;
  }

  private key(roomId: number, gameType: string): string {
    return `${roomId}:${gameType}`;
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

  private snapshot(state: GameStateEntity, seq: number): GameSnapshot {
    return {
      seq,
      version: this.ensureVersion(state),
      state: this.clone(state),
    };
  }

  private ensureTimeline(key: string, state: GameStateEntity): GameTimeline {
    const existing = this.timelines.get(key);
    if (existing) return existing;
    const initial = this.snapshot(state, 0);
    const created = { initial, events: [], snapshots: [initial] };
    this.timelines.set(key, created);
    return created;
  }

  private capturePeriodicSnapshot(
    timeline: GameTimeline,
    state: GameStateEntity,
  ): void {
    const sequence = timeline.events.at(-1)?.seq ?? 0;
    const previous = timeline.snapshots.at(-1)?.seq ?? 0;
    if (sequence - previous < SNAPSHOT_INTERVAL) return;
    timeline.snapshots.push(this.snapshot(state, sequence));
  }
}
