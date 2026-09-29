import { compileJsonGame } from '../../../rules/public-api';
import manifest from '../../../games/vents-sacres/foulees-fantastiques/manifest.json';
import documentSource from '../../../games/vents-sacres/foulees-fantastiques/game.json';
import catalogue from '../../../games/vents-sacres/foulees-fantastiques/catalogue.json';
const assets = { 'content/catalogue.json': catalogue };
const patternIndex = documentSource.patterns.findIndex(
  (pattern) => pattern.kind === 'team-pawn-race',
);
it.each([{ setId: 'missing' }, { diceId: 'missing' }])(
  'rejects invalid team-pawn race references %j',
  (override) => {
    const document = structuredClone(documentSource);
    document.patterns[patternIndex] = {
      ...document.patterns[patternIndex],
      ...override,
    } as (typeof document.patterns)[number];
    expect(() => compileJsonGame(manifest, document, assets)).toThrow();
  },
);
