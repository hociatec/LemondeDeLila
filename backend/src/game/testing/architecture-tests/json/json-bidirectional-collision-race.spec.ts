import { compileJsonGame } from '../../../rules/public-api';
import manifest from '../../../games/les-quatre-vents/galopons-ensemble/manifest.json';
import documentSource from '../../../games/les-quatre-vents/galopons-ensemble/game.json';
import catalogue from '../../../games/les-quatre-vents/galopons-ensemble/content/catalogue.json';
const assets = { 'content/catalogue.json': catalogue };
const patternIndex = documentSource.patterns.findIndex(
  (pattern) => pattern.kind === 'bidirectional-collision-race',
);
it.each([
  { trackId: 'missing' },
  { diceId: 'missing' },
  { deckId: 'missing' },
  { pawnSetId: 'missing' },
  { appleResource: 'missing' },
])('rejects invalid bidirectional collision references %j', (override) => {
  const document = structuredClone(documentSource);
  document.patterns[patternIndex] = {
    ...document.patterns[patternIndex],
    ...override,
  } as (typeof document.patterns)[number];
  expect(() => compileJsonGame(manifest, document, assets)).toThrow();
});
