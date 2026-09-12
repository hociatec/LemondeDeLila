import { compileJsonGame } from './json-game-compiler';
import manifest from '../../../games/les-quatre-vents/mon-village-mon-histoire/manifest.json';
import document from '../../../games/les-quatre-vents/mon-village-mon-histoire/game.json';
import catalogue from '../../../games/les-quatre-vents/mon-village-mon-histoire/content/catalogue.json';

const assets = { 'content/catalogue.json': catalogue };

it.each([
  { trackId: 'missing' },
  { diceId: 'missing' },
  {
    zones: document.collectionRace.zones.map((zone, index) =>
      index === 0 ? { ...zone, deckId: 'missing' } : zone,
    ),
  },
  {
    zones: document.collectionRace.zones.map((zone, index) =>
      index === 0 ? { ...zone, resourceId: 'missing' } : zone,
    ),
  },
])('rejects invalid collection race references %j', (extension) => {
  expect(() =>
    compileJsonGame(
      manifest,
      {
        ...document,
        collectionRace: { ...document.collectionRace, ...extension },
      },
      assets,
    ),
  ).toThrow();
});

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
    compileJsonGame(manifest, document, {
      'content/catalogue.json': { ...catalogue, zones },
    }),
  ).toThrow(/matching zoneId/);
});
