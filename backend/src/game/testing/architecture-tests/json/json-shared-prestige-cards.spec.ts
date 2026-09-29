import { compileJsonGame } from '../../../rules/public-api';
import manifest from '../../../games/vents-dansants/olympia/manifest.json';
import documentSource from '../../../games/vents-dansants/olympia/game.json';
import catalogue from '../../../games/vents-dansants/olympia/catalogue.json';

const assets = { 'content/catalogue.json': catalogue };
const patternIndex = documentSource.patterns.findIndex(
  (pattern) => pattern.kind === 'shared-prestige-cards',
);

it.each([{ handId: 'missing' }, { deckIds: ['missing'] }])(
  'rejects invalid shared prestige references %j',
  (override) => {
    const document = structuredClone(documentSource);
    document.patterns[patternIndex] = {
      ...document.patterns[patternIndex],
      ...override,
    } as (typeof document.patterns)[number];
    expect(() => compileJsonGame(manifest, document, assets)).toThrow();
  },
);
