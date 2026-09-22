import { InMemoryGameSessionStore } from './in-memory-game-session.store';
import type { GameState } from '../../../application/models/game-state.model';

it('preserves replay data at capacity, allows replacements and reuses cleared capacity', async () => {
  const store = new InMemoryGameSessionStore();
  const state: GameState = {
    status: 'started',
    phase: 'playing',
    log: [],
    version: 1,
  };
  for (let id = 1; id <= 10_000; id++) await store.restore(id, 'test', state);
  await expect(store.restore(10_001, 'test', state)).rejects.toThrow(
    'capacity exceeded',
  );
  expect(await store.replay(1, 'test')).toMatchObject(state);
  expect(await store.load(10_000, 'test')).toMatchObject(state);
  await expect(
    store.restore(1, 'test', { ...state, version: 2 }),
  ).resolves.toHaveProperty('version', 2);
  await store.clear(2, 'test');
  expect(await store.replay(2, 'test')).toBeNull();
  await expect(store.restore(10_001, 'test', state)).resolves.toMatchObject(
    state,
  );
});
