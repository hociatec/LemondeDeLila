import { compileJsonGame } from './json-game-compiler';
import manifest from '../../../games/vents-sacres/jeu-oie/manifest.json';
import document from '../../../games/vents-sacres/jeu-oie/game.json';
import catalogue from '../../../games/vents-sacres/jeu-oie/content/catalogue.json';

const assets = { 'content/catalogue.json': catalogue };

it.each([
  { trackId: 'missing' },
  { diceId: 'missing' },
  { playingPhase: 'missing' },
  { bridgeDestination: 64 },
  { pawnSelection: { setId: 'missing', choiceId: 'goose.pawn' } },
])('rejects invalid goose race references %j', (extension) => {
  expect(() =>
    compileJsonGame(
      manifest,
      { ...document, gooseRace: { ...document.gooseRace, ...extension } },
      assets,
    ),
  ).toThrow();
});

it('requires the goose program and its victory together', () => {
  expect(() =>
    compileJsonGame(
      manifest,
      {
        ...document,
        victory: {
          kind: 'track-finish',
          trackId: 'goose-board',
          ties: 'all',
        },
      },
      assets,
    ),
  ).toThrow(/goose race program and victory required together/);
});
