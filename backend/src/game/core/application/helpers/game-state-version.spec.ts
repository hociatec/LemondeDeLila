import { gameStateVersion } from './game-state-version';
import type { GameState } from '../models/game-state.model';

it('reads a fallback version without modifying the snapshot', () => {
  const state: GameState = {
    status: 'started',
    phase: 'playing',
    log: [],
  };
  Object.freeze(state);
  expect(gameStateVersion(state)).toBe(1);
  expect(state.version).toBeUndefined();
});
