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
    resources: { ...document.resourceTrackRace.resources, leaves: 'missing' },
  },
  { faces: ['herbivore', 'danger'] },
])('rejects invalid resource track race references %j', (extension) => {
  expect(() =>
    compileJsonGame(
      manifest,
      {
        ...document,
        resourceTrackRace: { ...document.resourceTrackRace, ...extension },
      },
      assets,
    ),
  ).toThrow();
});

it('requires the resource track program and victory together', () => {
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
  ).toThrow(/resource track race program and victory required together/);
});
