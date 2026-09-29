import { compileJsonGame } from '../../../rules/public-api';
import manifest from '../../../games/vents-dansants/la-grande-mine-de-barbak/manifest.json';
import documentSource from '../../../games/vents-dansants/la-grande-mine-de-barbak/game.json';
import catalogue from '../../../games/vents-dansants/la-grande-mine-de-barbak/content/catalogue.json';
const assets = { 'content/catalogue.json': catalogue };
const patternIndex = documentSource.patterns.findIndex(
  (pattern) => pattern.kind === 'public-domain-cards',
);
it.each([
  { deckId: 'missing' },
  { handId: 'missing' },
  { inventoryId: 'missing' },
  { lossCategory: 'missing' },
])('rejects invalid public-domain card references %j', (override) => {
  const document = structuredClone(documentSource);
  document.patterns[patternIndex] = {
    ...document.patterns[patternIndex],
    ...override,
  } as (typeof document.patterns)[number];
  expect(() => compileJsonGame(manifest, document, assets)).toThrow();
});
