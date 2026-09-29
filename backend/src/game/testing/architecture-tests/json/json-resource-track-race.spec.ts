import { compileJsonGame } from '../../../rules/public-api';
import manifest from '../../../games/les-quatre-vents/primalis/manifest.json';
import documentSource from '../../../games/les-quatre-vents/primalis/game.json';
import catalogue from '../../../games/les-quatre-vents/primalis/content/catalogue.json';

const assets = { 'content/catalogue.json': catalogue };
const patternIndex = documentSource.patterns.findIndex(
  (pattern) => pattern.kind === 'resource-track-race',
);

it.each([
  { trackId: 'missing' },
  { diceId: 'missing' },
  { dangerCounter: 'missing' },
])('rejects invalid resource track references %j', (override) => {
  const document = structuredClone(documentSource);
  const pattern = document.patterns[patternIndex];
  if (pattern.kind !== 'resource-track-race' || !pattern.config)
    throw new Error('Missing pattern');
  Object.assign(pattern.config, override);
  expect(() => compileJsonGame(manifest, document, assets)).toThrow();
});
