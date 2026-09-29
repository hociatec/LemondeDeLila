import { compileJsonGame } from '../../../rules/public-api';
import manifest from '../../../games/les-quatre-vents/pirates-en-vadrouille/manifest.json';
import documentSource from '../../../games/les-quatre-vents/pirates-en-vadrouille/game.json';
import catalogue from '../../../games/les-quatre-vents/pirates-en-vadrouille/content/catalogue.json';

const assets = { 'content/catalogue.json': catalogue };
const patternIndex = documentSource.patterns.findIndex(
  (pattern) => pattern.kind === 'treasure-track-race',
);

it.each([{ trackId: 'missing' }, { diceId: 'missing' }])(
  'rejects invalid treasure-track references %j',
  (override) => {
    const document = structuredClone(documentSource);
    document.patterns[patternIndex] = {
      ...document.patterns[patternIndex],
      ...override,
    } as (typeof document.patterns)[number];
    expect(() => compileJsonGame(manifest, document, assets)).toThrow();
  },
);

it('rejects a draw rule referencing an unknown deck key', () => {
  const document = structuredClone(documentSource);
  const pattern = document.patterns[patternIndex];
  if (
    pattern?.kind !== 'treasure-track-race' ||
    !('tileRules' in pattern) ||
    !pattern.tileRules
  )
    throw new Error('missing pattern');
  pattern.tileRules.treasure = { kind: 'draw', deck: 'missing' };
  expect(() => compileJsonGame(manifest, document, assets)).toThrow(
    /unknown draw deck/,
  );
});
