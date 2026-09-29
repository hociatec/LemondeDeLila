import { compileJsonGame } from '../../../rules/public-api';
import manifest from '../../../games/les-quatre-vents/en-attendant-minuit/manifest.json';
import documentSource from '../../../games/les-quatre-vents/en-attendant-minuit/game.json';
import catalogue from '../../../games/les-quatre-vents/en-attendant-minuit/catalogue.json';
const assets = { 'content/catalogue.json': catalogue };
const patternIndex = documentSource.patterns.findIndex(
  (pattern) => pattern.kind === 'bounce-quiz-race',
);
it.each([
  { trackId: 'missing' },
  { diceId: 'missing' },
  { deckId: 'missing' },
  { pawnSetId: 'missing' },
])('rejects invalid bounce-quiz references %j', (override) => {
  const document = structuredClone(documentSource);
  document.patterns[patternIndex] = {
    ...document.patterns[patternIndex],
    ...override,
  } as (typeof document.patterns)[number];
  expect(() => compileJsonGame(manifest, document, assets)).toThrow();
});
