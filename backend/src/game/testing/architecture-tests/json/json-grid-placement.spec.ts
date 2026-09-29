import { compileJsonGame } from '../../../rules/public-api';
import manifest from '../../../games/vents-sacres/morpion/manifest.json';
import documentSource from '../../../games/vents-sacres/morpion/game.json';
import pawns from '../../../games/vents-sacres/morpion/content/pawns.json';
import { testGame } from '../../../engine/testing/public-api';

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
  {
    pawnSelection: {
      ...documentSource.patterns[0].pawnSelection,
      setId: 'missing',
    },
  },
  {
    pawnSelection: {
      ...documentSource.patterns[0].pawnSelection,
      order: 'runtime-script',
    },
  },
  { expression: 'grid[x][y] = actor' },
])('rejects an invalid grid placement pattern %j', (mutation) => {
  const document = structuredClone(documentSource);
  document.patterns[0] = {
    ...document.patterns[0],
    ...mutation,
  } as (typeof document.patterns)[number];
  expect(() => compileJsonGame(manifest, document, assets)).toThrow();
});

it('runs a rectangular alignment game using only changed JSON data', async () => {
  const document = structuredClone(documentSource);
  const { pawnSelection: _selection, ...pattern } = document.patterns[0];
  const definition = compileJsonGame(
    { ...manifest, code: 'rectangle', engine: 'rectangle' },
    {
      ...document,
      components: [],
      patterns: [
        {
          ...pattern,
          width: 2,
          height: 4,
          winLength: 3,
          preferredCells: [],
          markEvent: 'rectangle.mark',
        },
      ],
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
