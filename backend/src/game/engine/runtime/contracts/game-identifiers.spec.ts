import { playerId, playerMap } from '../game-identifiers';

it('uses signed nonzero IDs consistently for players and bots', () => {
  expect(playerId(-7)).toBe(-7);
  expect(playerId(7)).toBe(7);
  expect(
    playerMap(
      [
        { id: 7, username: 'Human' },
        { id: -7, username: 'Bot', isBot: true },
      ],
      0,
    ),
  ).toEqual({ '7': 0, '-7': 0 });
  for (const id of [0, 1.5, NaN, Infinity, Number.MIN_SAFE_INTEGER - 1]) {
    expect(() => playerId(id)).toThrow();
    expect(() => playerMap([{ id, username: 'Invalid' }], 0)).toThrow();
  }
});
