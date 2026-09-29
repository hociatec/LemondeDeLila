import { compileJsonGame } from '../../../rules/public-api';
import manifest from '../../../games/vents-dansants/la-bande-a-banane/manifest.json';
import documentSource from '../../../games/vents-dansants/la-bande-a-banane/game.json';
import catalogue from '../../../games/vents-dansants/la-bande-a-banane/catalogue.json';
const assets = { 'content/catalogue.json': catalogue };
const patternIndex = documentSource.patterns.findIndex(
  (pattern) => pattern.kind === 'species-troops',
);
it.each([
  { deckId: 'missing' },
  { handId: 'missing' },
  { inventoryId: 'missing' },
])('rejects invalid species-troops references %j', (override) => {
  const document = structuredClone(documentSource);
  document.patterns[patternIndex] = {
    ...document.patterns[patternIndex],
    ...override,
  } as (typeof document.patterns)[number];
  expect(() => compileJsonGame(manifest, document, assets)).toThrow();
});
