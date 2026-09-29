import { compileJsonGame } from '../../../rules/public-api';
import manifest from '../../../games/les-quatre-vents/frousse-party/manifest.json';
import documentSource from '../../../games/les-quatre-vents/frousse-party/game.json';
import catalogue from '../../../games/les-quatre-vents/frousse-party/content/catalogue.json';

const assets = { 'content/catalogue.json': catalogue };
const patternIndex = documentSource.patterns.findIndex(
  (pattern) => pattern.kind === 'protected-haunted-race',
);

it.each([
  { trackId: 'missing' },
  { diceId: 'missing' },
  { deckId: 'missing' },
  { pawnSetId: 'missing' },
])('rejects invalid protected haunted race references %j', (override) => {
  const document = structuredClone(documentSource);
  document.patterns[patternIndex] = {
    ...document.patterns[patternIndex],
    ...override,
  } as (typeof document.patterns)[number];
  expect(() => compileJsonGame(manifest, document, assets)).toThrow();
});

it('rejects invalid tile and protection references', () => {
  const document = structuredClone(documentSource) as unknown as {
    patterns: Array<Record<string, unknown>>;
  };
  const pattern = document.patterns[patternIndex];
  const tiles = structuredClone(catalogue.tiles);
  tiles[1].n = 999;
  pattern.tiles = tiles;
  const protections = pattern.protections as Array<Record<string, unknown>>;
  protections[0].category = 'missing';
  expect(() => compileJsonGame(manifest, document, assets)).toThrow();
});
