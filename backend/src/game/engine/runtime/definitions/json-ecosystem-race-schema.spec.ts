import { compileJsonGame } from './json-game-compiler';
import manifest from '../../../games/les-quatre-vents/primalis/manifest.json';
import document from '../../../games/les-quatre-vents/primalis/game.json';
import catalogue from '../../../games/les-quatre-vents/primalis/content/catalogue.json';

const assets = { 'content/catalogue.json': catalogue };

it.each([
  { trackId: 'missing' },
  { diceId: 'missing' },
  { dangerCounter: 'missing' },
  {
    resources: { ...document.ecosystemRace.resources, leaves: 'missing' },
  },
  { faces: ['herbivore', 'danger'] },
])('rejects invalid ecosystem race references %j', (extension) => {
  expect(() =>
    compileJsonGame(
      manifest,
      {
        ...document,
        ecosystemRace: { ...document.ecosystemRace, ...extension },
      },
      assets,
    ),
  ).toThrow();
});

it('requires the ecosystem program and victory together', () => {
  expect(() =>
    compileJsonGame(
      manifest,
      {
        ...document,
        victory: {
          kind: 'track-finish',
          trackId: 'comet',
          ties: 'all',
        },
      },
      assets,
    ),
  ).toThrow(/ecosystem race program and victory required together/);
});
