import { compileJsonGame } from '../../../rules/public-api';
import manifest from '../../../games/les-quatre-vents/a-fond-les-ballons/manifest.json';
import documentSource from '../../../games/les-quatre-vents/a-fond-les-ballons/game.json';
import catalogue from '../../../games/les-quatre-vents/a-fond-les-ballons/catalogue.json';

const assets = { 'content/catalogue.json': catalogue };
const patternIndex = documentSource.patterns.findIndex(
  (pattern) => pattern.kind === 'chained-tile-race',
);

it.each([
  { trackId: 'missing' },
  { diceId: 'missing' },
  { deckId: 'missing' },
  { pawnSetId: 'missing' },
])('rejects invalid chained tile race references %j', (override) => {
  const document = structuredClone(documentSource);
  const pattern = document.patterns[patternIndex];
  if (pattern.kind !== 'chained-tile-race' || !pattern.config)
    throw new Error('Missing pattern');
  Object.assign(pattern.config, override);
  expect(() => compileJsonGame(manifest, document, assets)).toThrow();
});
