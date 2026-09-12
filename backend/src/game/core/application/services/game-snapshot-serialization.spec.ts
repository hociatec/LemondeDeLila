import { asGameId, asRoomId } from '../../../../shared/interfaces/public-api';
import { InMemoryGameSessionStore } from '../../infrastructure/persistence/memory/in-memory-game-session.store';
import { GameEngineService } from './game-engine.service';
import {
  assertGameStateSize,
  createGameTimeline,
  replayTimeline,
} from './game-timeline';
import type { GameState } from '../models/game-state.model';
import { DataSource } from 'typeorm';
import { GameSessionTypeormStore } from '../../infrastructure/persistence/typeorm/repositories/game-session-typeorm.store';
import { GameSessionEntity } from '../../infrastructure/persistence/typeorm/entities/game-session.entity';

class CustomState {
  score = 2;
}

it('rejects invalid SQL snapshots before starting a transaction', async () => {
  const source = new DataSource({ type: 'mysql', database: 'validation_only' });
  const transaction = jest.spyOn(source.manager, 'transaction');
  const store = new GameSessionTypeormStore(
    source.getRepository(GameSessionEntity),
  );
  const invalid = { ...base(), game: new CustomState() };
  try {
    await expect(
      store.restore(asRoomId(7), asGameId('example'), invalid),
    ).rejects.toThrow('non serialisable');
    await expect(
      store.compareAndSet({
        roomId: asRoomId(7),
        gameType: asGameId('example'),
        expectedVersion: 1,
        next: invalid,
        pendingEvents: [],
        occurredAtMs: 1,
      }),
    ).rejects.toThrow('non serialisable');
    expect(transaction).not.toHaveBeenCalled();
  } finally {
    transaction.mockRestore();
  }
});

const base = (): GameState => ({
  status: 'started',
  phase: 'playing',
  log: [],
  version: 1,
});

it.each([new CustomState(), new Map(), { nested: new Date() }])(
  'rejects unsupported instances before cloning or writing: %p',
  async (game) => {
    const store = new InMemoryGameSessionStore();
    const engine = new GameEngineService(store, store);
    const original = await store.restore(
      asRoomId(7),
      asGameId('example'),
      base(),
    );
    const invalid = { ...base(), game };
    expect(() => assertGameStateSize(invalid, null)).toThrow(
      'non serialisable',
    );
    expect(() => createGameTimeline(invalid)).toThrow('non serialisable');
    await expect(
      engine.restoreInternalState(7, 'example', invalid),
    ).rejects.toThrow('non serialisable');
    await expect(
      store.restore(asRoomId(7), asGameId('example'), invalid),
    ).rejects.toThrow('non serialisable');
    await expect(
      store.compareAndSet({
        roomId: asRoomId(7),
        gameType: asGameId('example'),
        expectedVersion: 1,
        next: invalid,
        pendingEvents: [],
        occurredAtMs: 1,
      }),
    ).rejects.toThrow('non serialisable');
    expect(await store.load(asRoomId(7), asGameId('example'))).toEqual(
      original,
    );
  },
);

it('does not evaluate a state accessor while restoring', async () => {
  const getter = jest.fn(() => 2);
  const invalid = {
    ...base(),
    game: Object.defineProperty({}, 'score', { get: getter, enumerable: true }),
  };
  const store = new InMemoryGameSessionStore();
  await expect(
    store.restore(asRoomId(7), asGameId('example'), invalid),
  ).rejects.toThrow('non serialisable');
  expect(getter).not.toHaveBeenCalled();
  expect(await store.load(asRoomId(7), asGameId('example'))).toBeNull();
});

it('preserves the explicit room timestamp compatibility during snapshot replay', () => {
  const state = {
    ...base(),
    metadata: { roomStartedAt: new Date('2026-09-11T12:00:00Z') },
  };
  const timeline = createGameTimeline(state);
  expect(replayTimeline(timeline)).toEqual(state);
  timeline.initial.state.game = new CustomState();
  for (const snapshot of timeline.snapshots)
    snapshot.state.game = new CustomState();
  expect(() => replayTimeline(timeline)).toThrow('non serialisable');
});
