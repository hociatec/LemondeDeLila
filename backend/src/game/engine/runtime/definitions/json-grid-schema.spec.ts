import { compileJsonGame } from './json-game-compiler';
import { testGame } from '../../testing/public-api';
import manifest from '../../../games/vents-sacres/morpion/manifest.json';
import composition from '../../../games/vents-sacres/morpion/game.json';
import pawns from '../../../games/vents-sacres/morpion/content/pawns.json';

const assets = { 'content/pawns.json': pawns };

it.each([
  { markEvent: 'engine.state.committed' },
  { width: 0 },
  { height: 33 },
  { winLength: 4 },
  { preferredCells: [{ x: 3, y: 0 }] },
  {
    preferredCells: [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ],
  },
  { pawnSelection: { ...composition.grid.pawnSelection, setId: 'missing' } },
  {
    pawnSelection: {
      ...composition.grid.pawnSelection,
      order: 'runtime-script',
    },
  },
  { expression: 'grid[x][y] = actor' },
])('rejects an invalid grid program %j', (mutation) => {
  expect(() =>
    compileJsonGame(
      manifest,
      {
        ...composition,
        grid: { ...composition.grid, ...mutation },
      },
      assets,
    ),
  ).toThrow();
});

it('refuses grid recipes and victory without a grid program', () => {
  const { grid: _grid, ...without } = composition;
  expect(() => compileJsonGame(manifest, without, assets)).toThrow(/grid/);
  expect(() =>
    compileJsonGame(
      manifest,
      {
        ...composition,
        victory: { kind: 'score-at-least', amount: 3 },
      },
      assets,
    ),
  ).toThrow(/grid/);
});

it('runs a rectangular alignment game using only changed JSON data', async () => {
  const { pawnSelection: _selection, ...grid } = composition.grid;
  const definition = compileJsonGame(
    { ...manifest, code: 'rectangle', engine: 'rectangle' },
    {
      ...composition,
      components: [],
      grid: {
        ...grid,
        width: 2,
        height: 4,
        winLength: 3,
        preferredCells: [],
        markEvent: 'rectangle.mark',
      },
    },
  );
  const game = await testGame(definition).players(2).seed(42).start();
  for (const [player, x, y] of [
    [1, 0, 0],
    [2, 1, 0],
    [1, 0, 1],
    [2, 1, 1],
    [1, 0, 2],
  ])
    await game.as(player).do('morpion_play', { x, y });
  expect(game.result()?.winnerPlayerIds).toEqual([1]);
  expect(await game.replay()).toEqual(game.state());
});

it('ends a filled grid without an alignment as a draw', async () => {
  const { pawnSelection: _selection, ...grid } = composition.grid;
  const game = await testGame(
    compileJsonGame(manifest, { ...composition, components: [], grid }),
  )
    .players(2)
    .seed(42)
    .start();
  const moves = [
    [0, 0],
    [1, 1],
    [2, 2],
    [0, 2],
    [2, 0],
    [1, 0],
    [1, 2],
    [2, 1],
    [0, 1],
  ];
  for (const [index, [x, y]] of moves.entries())
    await game.as((index % 2) + 1).do('morpion_play', { x, y });
  expect(game.state().status).toBe('finished');
  expect(game.result()?.winnerPlayerIds).toEqual([]);
  expect(game.result()?.reason).toBe('draw');
});
