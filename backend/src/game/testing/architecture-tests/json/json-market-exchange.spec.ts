import { compileJsonGame } from '../../../rules/public-api';
import manifest from '../../../games/vents-dansants/le-marche-des-merveilles/manifest.json';
import source from '../../../games/vents-dansants/le-marche-des-merveilles/game.json';
import catalogue from '../../../games/vents-dansants/le-marche-des-merveilles/content/catalogue.json';

const assets = { 'content/catalogue.json': catalogue };

it.each([
  { rumorCost: -1 },
  { protectCost: -1 },
  { buyRecipe: '' },
  { sellAction: '' },
  { eventNamespace: '' },
])('rejects invalid market exchange options %j', (mutation) => {
  const document = structuredClone(source);
  const pattern = document.patterns[0];
  pattern.exchange = {
    ...pattern.exchange,
    ...mutation,
  } as typeof pattern.exchange;
  expect(() => compileJsonGame(manifest, document, assets)).toThrow();
});
