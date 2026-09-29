import { compileJsonGame } from '../../../rules/public-api';
import manifest from '../../../games/les-quatre-vents/mon-village-mon-histoire/manifest.json';
import documentSource from '../../../games/les-quatre-vents/mon-village-mon-histoire/game.json';
import catalogue from '../../../games/les-quatre-vents/mon-village-mon-histoire/content/catalogue.json';

const assets = { 'content/catalogue.json': catalogue };
const patternIndex = documentSource.patterns.findIndex(
  (pattern) => pattern.kind === 'track-zone-collection',
);

it.each([{ trackId: 'missing' }, { diceId: 'missing' }])(
  'rejects invalid track-zone references %j',
  (override) => {
    const document = structuredClone(documentSource);
    document.patterns[patternIndex] = {
      ...document.patterns[patternIndex],
      ...override,
    } as (typeof document.patterns)[number];
    expect(() => compileJsonGame(manifest, document, assets)).toThrow();
  },
);

it('rejects cards attached to another zone', () => {
  const zones = catalogue.zones.map((zone, index) =>
    index === 0
      ? {
          ...zone,
          cards: zone.cards.map((card) => ({
            ...card,
            attributes: { zoneId: 2 },
          })),
        }
      : zone,
  );
  expect(() =>
    compileJsonGame(manifest, documentSource, {
      'content/catalogue.json': { ...catalogue, zones },
    }),
  ).toThrow(/matching zoneId/);
});
