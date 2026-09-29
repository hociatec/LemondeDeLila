import { compileJsonGame } from '../../../rules/public-api';
import manifest from '../../../games/vents-sacres/jeu-oie/manifest.json';
import documentSource from '../../../games/vents-sacres/jeu-oie/game.json';
import catalogue from '../../../games/vents-sacres/jeu-oie/content/catalogue.json';

const assets = { 'content/catalogue.json': catalogue };
const patternIndex = documentSource.patterns.findIndex(
  (pattern) => pattern.kind === 'goose-race',
);

it.each([
  { trackId: 'missing' },
  { diceId: 'missing' },
  { playingPhase: 'missing' },
  { bridgeDestination: 64 },
  { pawnSelection: { setId: 'missing', choiceId: 'goose.pawn' } },
])('rejects invalid generic goose references %j', (override) => {
  const document = structuredClone(documentSource);
  document.patterns[patternIndex] = {
    ...document.patterns[patternIndex],
    ...override,
  } as (typeof document.patterns)[number];
  expect(() => compileJsonGame(manifest, document, assets)).toThrow();
});

it('rejects a goose tile without a declared operation', () => {
  const document = structuredClone(documentSource);
  const pattern = document.patterns[patternIndex] as unknown as {
    tileRules: Record<string, string>;
  };
  delete pattern.tileRules.start;
  expect(() => compileJsonGame(manifest, document, assets)).toThrow(
    /unknown tile rule/,
  );
});
