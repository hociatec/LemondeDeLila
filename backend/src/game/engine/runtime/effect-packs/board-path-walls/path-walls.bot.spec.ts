import { choosePathWallsTurn } from './path-walls.bot';

const base = {
  size: 9,
  own: { x: 4, y: 8 },
  opponent: { x: 4, y: 1 },
  goal: 0,
  opponentGoal: 8,
  walls: [],
  candidates: [],
  moves: [
    { x: 5, y: 8 },
    { x: 3, y: 8 },
    { x: 4, y: 7 },
  ],
};
it('advances toward the goal instead of the first lateral move', () => {
  expect(choosePathWallsTurn(base)).toEqual({
    kind: 'move',
    payload: { x: 4, y: 7 },
  });
});
it('places a legal wall when it delays a closer opponent more than itself', () => {
  const state = {
    ...base,
    own: { x: 0, y: 8 },
    opponent: { x: 4, y: 7 },
    moves: [{ x: 0, y: 7 }],
    candidates: [{ x: 4, y: 7, orientation: 'h' as const }],
  };
  expect(choosePathWallsTurn(state)).toEqual({
    kind: 'wall',
    payload: state.candidates[0],
  });
});
it('wins immediately rather than building a wall', () => {
  expect(
    choosePathWallsTurn({
      ...base,
      own: { x: 4, y: 1 },
      moves: [{ x: 4, y: 0 }],
      candidates: [{ x: 4, y: 7, orientation: 'h' }],
    }),
  ).toEqual({ kind: 'move', payload: { x: 4, y: 0 } });
});
it('takes a detour around a wall on its route', () => {
  expect(
    choosePathWallsTurn({
      ...base,
      own: { x: 4, y: 8 },
      walls: [{ x: 3, y: 7, orientation: 'h' }],
      moves: [
        { x: 3, y: 8 },
        { x: 5, y: 8 },
      ],
    }),
  ).toEqual({ kind: 'move', payload: { x: 5, y: 8 } });
});
