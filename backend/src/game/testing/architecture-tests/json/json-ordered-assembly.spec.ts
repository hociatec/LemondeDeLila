import { compileJsonGame } from '../../../rules/public-api';
import manifest from '../../../games/vents-dansants/pimp-my-ride/manifest.json';
import source from '../../../games/vents-dansants/pimp-my-ride/game.json';
import catalogue from '../../../games/vents-dansants/pimp-my-ride/content/catalogue.json';

it.each([
  { deckId: 'missing' },
  { handId: 'missing' },
  { currentInventoryId: 'missing' },
  { completedCountResource: 'missing' },
  { nameCounter: 'missing' },
])('rejects invalid ordered assembly references %j', (mutation) => {
  const document = structuredClone(source);
  document.patterns[0] = {
    ...document.patterns[0],
    ...mutation,
  } as (typeof document.patterns)[number];
  expect(() =>
    compileJsonGame(manifest, document, {
      'content/catalogue.json': catalogue,
    }),
  ).toThrow();
});
