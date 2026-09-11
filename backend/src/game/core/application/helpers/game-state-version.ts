import type { GameState } from '../models/game-state.model';

/** Reading a presentation version must never repair the source snapshot. */
export function gameStateVersion(state: GameState): number {
  const version = Number(state.version);
  return Number.isSafeInteger(version) && version > 0 ? version : 1;
}
