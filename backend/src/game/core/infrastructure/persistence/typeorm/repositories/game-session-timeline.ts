import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { LessThanOrEqual, MoreThan, type EntityManager } from 'typeorm';
import type { GameState } from '../../../../application/models/game-state.model';
import type { GameSnapshot } from '../../../../application/models/game-event.model';
import type { GameStateCommit } from '../../../../application/ports/game-state-store.port';
import type { GameSnapshotPolicy } from '../../../../application/ports/game-event-store.port';
import {
  assertGameStateSize,
  replayTimeline,
  sequenceEvents,
} from '../../../../application/services/game-timeline';
import { createStatePatch } from '../../../../application/services/game-state-patch';
import { GameSessionEventEntity } from '../entities/game-session-event.entity';
import { GameSessionSnapshotEntity } from '../entities/game-session-snapshot.entity';

const PAGE_SIZE = 500;

export async function appendSqlTimeline(
  manager: EntityManager,
  commit: GameStateCommit,
  previous: GameState,
  next: GameState,
  policy: Readonly<GameSnapshotPolicy>,
): Promise<void> {
  assertGameStateSize(next, policy.maxStateBytes);
  const key = { roomId: commit.roomId, gameType: commit.gameType };
  const repository = manager.getRepository(GameSessionEventEntity);
  const snapshots = manager.getRepository(GameSessionSnapshotEntity);
  const last = await repository.findOne({ where: key, order: { seq: 'DESC' } });
  const snapshot = await snapshots.findOne({
    where: key,
    order: { seq: 'DESC' },
  });
  const events = sequenceEvents({
    pending: commit.pendingEvents,
    patch: createStatePatch(previous, next),
    previousSequence: last?.seq ?? snapshot?.seq ?? 0,
    version: next.version ?? commit.expectedVersion + 1,
    fallbackTimeMs: commit.occurredAtMs,
  });
  // INSERT must fail on a duplicate sequence; it must never overwrite history.
  await repository.insert(
    events.map(
      (event) =>
        ({
          ...key,
          seq: event.seq,
          version: event.version,
          event,
        }) as QueryDeepPartialEntity<GameSessionEventEntity>,
    ),
  );
  const lastEvent = events.at(-1);
  if (!lastEvent) throw new Error('Missing committed event');
  const sequence = lastEvent.seq;
  const since = snapshot?.seq ?? 0;
  const everyEvents = threshold(policy.everyEvents);
  const maxEventBytes = threshold(policy.maxEventBytes);
  const countReached = everyEvents !== null && sequence - since >= everyEvents;
  if (
    countReached ||
    (maxEventBytes !== null &&
      (await eventBytesReached(manager, key, since, maxEventBytes)))
  ) {
    await snapshots.insert({
      ...key,
      seq: sequence,
      version: next.version ?? 1,
      state: next,
    } as QueryDeepPartialEntity<GameSessionSnapshotEntity>);
  }
}

async function eventBytesReached(
  manager: EntityManager,
  key: { roomId: number; gameType: string },
  after: number,
  threshold: number,
): Promise<boolean> {
  let bytes = 2;
  let sequence = after;
  for (;;) {
    const rows = await manager.getRepository(GameSessionEventEntity).find({
      where: { ...key, seq: MoreThan(sequence) },
      order: { seq: 'ASC' },
      take: PAGE_SIZE,
    });
    for (const row of rows) {
      bytes +=
        Buffer.byteLength(JSON.stringify(row.event), 'utf8') +
        (sequence > after ? 1 : 0);
      sequence = row.seq;
      if (bytes >= threshold) return true;
    }
    if (rows.length < PAGE_SIZE) return false;
  }
}

export async function replaySqlTimeline(
  manager: EntityManager,
  roomId: number,
  gameType: string,
  untilSequence?: number,
): Promise<GameState> {
  const key = { roomId, gameType };
  const snapshot = await manager
    .getRepository(GameSessionSnapshotEntity)
    .findOne({
      where: {
        ...key,
        ...(untilSequence === undefined
          ? {}
          : { seq: LessThanOrEqual(untilSequence) }),
      },
      order: { seq: 'DESC' },
    });
  if (!snapshot) throw new Error('Missing initial game snapshot');
  let current: GameSnapshot = {
    seq: snapshot.seq,
    version: snapshot.version,
    state: snapshot.state,
  };
  for (;;) {
    const rows = await manager.getRepository(GameSessionEventEntity).find({
      where: { ...key, seq: MoreThan(current.seq) },
      order: { seq: 'ASC' },
      take: PAGE_SIZE,
    });
    const events = rows
      .map((row) => row.event)
      .filter(
        (event) => untilSequence === undefined || event.seq <= untilSequence,
      );
    const state = replayTimeline(
      { initial: current, snapshots: [current], events },
      untilSequence,
    );
    if (
      rows.length < PAGE_SIZE ||
      events.length !== rows.length ||
      !events.length
    )
      return state;
    const lastEvent = events.at(-1);
    if (!lastEvent) return state;
    current = {
      seq: lastEvent.seq,
      version: state.version ?? current.version,
      state,
    };
  }
}

function threshold(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : null;
}
