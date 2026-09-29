import { compileJsonGame } from '../../../rules/public-api';
import manifest from '../../../games/les-quatre-vents/tout-pres-de-maman/manifest.json';
import documentSource from '../../../games/les-quatre-vents/tout-pres-de-maman/game.json';
import catalogue from '../../../games/les-quatre-vents/tout-pres-de-maman/content/catalogue.json';

const assets = { 'content/catalogue.json': catalogue };
const patternIndex = documentSource.patterns.findIndex(
  (pattern) => pattern.kind === 'paired-pawn-race',
);

it.each([{ trackId: 'missing' }, { diceId: 'missing' }, { deckId: 'missing' }])(
  'rejects invalid paired-pawn references %j',
  (override) => {
    const document = structuredClone(documentSource);
    document.patterns[patternIndex] = {
      ...document.patterns[patternIndex],
      ...override,
    } as (typeof document.patterns)[number];
    expect(() => compileJsonGame(manifest, document, assets)).toThrow();
  },
);
