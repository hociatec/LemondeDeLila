import { compileJsonGame } from '../../../rules/public-api';
import manifest from '../../../games/vents-dansants/cercles-sacres/manifest.json';
import documentSource from '../../../games/vents-dansants/cercles-sacres/game.json';
import catalogue from '../../../games/vents-dansants/cercles-sacres/content/catalogue.json';

const assets = { 'content/catalogue.json': catalogue };

it.each([
  { deckId: 'missing' },
  { handId: 'missing' },
  { inventoryId: 'missing' },
  { cardsPerCircle: 5 },
  { handMinimum: 9 },
])('rejects invalid themed-set collection references %j', (override) => {
  const document = structuredClone(documentSource);
  document.patterns[0] = {
    ...document.patterns[0],
    ...override,
  } as (typeof document.patterns)[number];
  expect(() => compileJsonGame(manifest, document, assets)).toThrow();
});

it('rejects duplicate themes', () => {
  const document = structuredClone(documentSource);
  const themes = [...catalogue.themes];
  themes[1] = themes[0];
  expect(() =>
    compileJsonGame(manifest, document, {
      'content/catalogue.json': { ...catalogue, themes },
    }),
  ).toThrow(/duplicate value/);
});
