import { compileJsonGame } from '../../../rules/public-api';
import manifest from '../../../games/les-quatre-vents/mission-galaxie/manifest.json';
import documentSource from '../../../games/les-quatre-vents/mission-galaxie/game.json';
import catalogue from '../../../games/les-quatre-vents/mission-galaxie/catalogue.json';
const assets = { 'content/catalogue.json': catalogue };
const patternIndex = documentSource.patterns.findIndex(
  (pattern) => pattern.kind === 'quiz-event-race',
);
it.each([
  { trackId: 'missing' },
  { diceId: 'missing' },
  { questionDeckId: 'missing' },
  { challengeDeckId: 'missing' },
  { eventDeckId: 'missing' },
])('rejects invalid quiz-event race references %j', (override) => {
  const document = structuredClone(documentSource);
  document.patterns[patternIndex] = {
    ...document.patterns[patternIndex],
    ...override,
  } as (typeof document.patterns)[number];
  expect(() => compileJsonGame(manifest, document, assets)).toThrow();
});
