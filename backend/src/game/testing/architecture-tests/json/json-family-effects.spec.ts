import { compileJsonGame } from '../../../rules/public-api';
import manifest from '../../../games/vents-dansants/les-mains-de-la-terre/manifest.json';
import documentSource from '../../../games/vents-dansants/les-mains-de-la-terre/game.json';
import catalogue from '../../../games/vents-dansants/les-mains-de-la-terre/catalogue.json';

const assets = { 'content/catalogue.json': catalogue };
const patternIndex = documentSource.patterns.findIndex(
  (pattern) => pattern.kind === 'family-effects',
);

it.each([{ deckId: 'missing' }, { handId: 'missing' }, { setsId: 'missing' }])(
  'rejects invalid family-effects references %j',
  (override) => {
    const document = structuredClone(documentSource);
    document.patterns[patternIndex] = {
      ...document.patterns[patternIndex],
      ...override,
    } as (typeof document.patterns)[number];
    expect(() => compileJsonGame(manifest, document, assets)).toThrow();
  },
);
