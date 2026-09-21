import type { FindOperator, Repository } from 'typeorm';
import { GameSessionTypeormStore } from './game-session-typeorm.store';
import { GameSessionEntity } from '../entities/game-session.entity';
import { GameSessionEventEntity } from '../entities/game-session-event.entity';
import type { GameState } from '../../../../application/models/game-state.model';
import type {
  GameEvent,
  GameSnapshot,
} from '../../../../application/models/game-event.model';
import {
  asRoomId,
  asGameId,
} from '../../../../../../shared/interfaces/public-api';

const state: GameState = {
  status: 'started',
  phase: 'playing',
  log: [],
  version: 1,
};

function event(seq: number): GameEvent {
  return {
    seq,
    version: seq + 1,
    schemaVersion: 1,
    actorId: null,
    type: 'engine.state.committed',
    occurredAtMs: seq,
    visibility: { kind: 'internal' },
    data: { patch: [{ operation: 'set', key: 'version', value: seq + 1 }] },
  };
}

function fixture(events: GameEvent[], snapshots: GameSnapshot[]) {
  const row = {
    roomId: 12,
    gameType: 'example',
    version: 4,
    state: { ...state, version: 4 },
  };
  const eventRepository = {
    findOne: jest.fn(async () => {
      const last = events.at(-1);
      return last ? { seq: last.seq, event: last } : null;
    }),
    find: jest.fn(
      async (options: { where: { seq: FindOperator<number> }; take: number }) =>
        events
          .filter((item) => item.seq > options.where.seq.value)
          .slice(0, options.take)
          .map((item) => ({ seq: item.seq, event: item })),
    ),
    insert: jest.fn(async (rows: { seq: number; event: GameEvent }[]) => {
      for (const added of rows) {
        if (events.some((item) => item.seq === added.seq))
          throw new Error('duplicate sequence');
        events.push(added.event);
      }
    }),
  };
  const snapshotRepository = {
    findOne: jest.fn(
      async (options: { where: { seq?: FindOperator<number> } }) =>
        [...snapshots]
          .reverse()
          .find((item) => item.seq <= (options.where.seq?.value ?? Infinity)) ??
        null,
    ),
    insert: jest.fn(async (snapshot: GameSnapshot) => {
      snapshots.push(snapshot);
    }),
  };
  const sessionRepository = {
    findOne: jest.fn(async () => row),
    save: jest.fn(),
  };
  const manager = {
    getRepository: (entity: unknown) =>
      entity === GameSessionEntity
        ? sessionRepository
        : entity === GameSessionEventEntity
          ? eventRepository
          : snapshotRepository,
  };
  const repository = {
    manager: {
      transaction: async (work: (value: typeof manager) => Promise<unknown>) =>
        work(manager),
    },
  } as unknown as Repository<GameSessionEntity>;
  return { repository, eventRepository, snapshotRepository, sessionRepository };
}

it('appends after event 10001 without loading history or overwriting an event', async () => {
  const events = Array.from({ length: 10001 }, (_, index) => event(index + 1));
  const f = fixture(events, [{ seq: 10000, version: 4, state }]);
  const store = new GameSessionTypeormStore(f.repository, {
    maxEventBytes: null,
  });
  await store.compareAndSet({
    roomId: asRoomId(12),
    gameType: asGameId('example'),
    expectedVersion: 4,
    next: { ...state, version: 4, phase: 'next' },
    pendingEvents: [],
    occurredAtMs: 100,
  });
  expect(events).toHaveLength(10002);
  expect(events[10000]).toEqual(event(10001));
  expect(events[10001]).toMatchObject({ seq: 10002, version: 5 });
  expect(f.eventRepository.find).not.toHaveBeenCalled();
});

it('replays every page beyond event 10000, and honors an intermediate sequence', async () => {
  const events = Array.from({ length: 10501 }, (_, index) => event(index + 1));
  const f = fixture(events, [{ seq: 0, version: 1, state }]);
  const store = new GameSessionTypeormStore(f.repository);
  expect(await store.replay(12, 'example')).toMatchObject({ version: 10502 });
  expect(await store.replay(12, 'example', 10003)).toMatchObject({
    version: 10004,
  });
  expect(await store.replay(12, 'example', 0)).toEqual(state);
  expect(
    f.eventRepository.find.mock.calls.every(([options]) => options.take <= 500),
  ).toBe(true);
  expect(f.sessionRepository.findOne).toHaveBeenCalledWith(
    expect.objectContaining({ lock: { mode: 'pessimistic_read' } }),
  );
});

it('uses the nearest snapshot even after the thousandth snapshot', async () => {
  const snapshots = Array.from({ length: 1002 }, (_, index) => ({
    seq: index * 25,
    version: index + 1,
    state: { ...state, version: index + 1 },
  }));
  const f = fixture([], snapshots);
  const store = new GameSessionTypeormStore(f.repository);
  expect(await store.replay(12, 'example')).toMatchObject({ version: 1002 });
  expect(await store.replay(12, 'example', 25000)).toMatchObject({
    version: 1001,
  });
  expect(f.eventRepository.find.mock.calls[0][0].where.seq.value).toBe(25025);
});

it('detects a missing event at a page boundary', async () => {
  const events = Array.from({ length: 1000 }, (_, index) =>
    event(index + 1),
  ).filter((item) => item.seq !== 501);
  const f = fixture(events, [{ seq: 0, version: 1, state }]);
  await expect(
    new GameSessionTypeormStore(f.repository).replay(12, 'example'),
  ).rejects.toThrow('Incomplete or duplicate');
});

it.each([
  { everyEvents: 2, maxEventBytes: null },
  { everyEvents: null, maxEventBytes: 1 },
])(
  'captures a snapshot when the configured threshold is reached: %j',
  async (policy) => {
    const f = fixture([event(1)], [{ seq: 0, version: 1, state }]);
    await new GameSessionTypeormStore(f.repository, policy).compareAndSet({
      roomId: asRoomId(12),
      gameType: asGameId('example'),
      expectedVersion: 4,
      next: { ...state, version: 4 },
      pendingEvents: [],
      occurredAtMs: 100,
    });
    expect(f.snapshotRepository.insert).toHaveBeenCalledWith(
      expect.objectContaining({ seq: 2, version: 5 }),
    );
  },
);
