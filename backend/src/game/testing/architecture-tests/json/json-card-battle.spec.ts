import { compileJsonGame } from '../../../rules/public-api';
import manifest from '../../../games/vents-dansants/zig-et-zag/manifest.json';
import documentSource from '../../../games/vents-dansants/zig-et-zag/game.json';
import catalogue from '../../../games/vents-dansants/zig-et-zag/catalogue.json';

const assets = { 'content/catalogue.json': catalogue };

it.each([{ deckId: 'missing' }, { handId: 'missing' }, { totalCards: 53 }])(
  'rejects invalid generic card-battle references %j',
  (override) => {
    const document = structuredClone(documentSource);
    document.patterns[0] = {
      ...document.patterns[0],
      ...override,
    } as (typeof document.patterns)[number];
    expect(() => compileJsonGame(manifest, document, assets)).toThrow();
  },
);

it('rejects duplicate card identifiers', () => {
  const document = structuredClone(documentSource);
  const cards = structuredClone(catalogue.cards);
  cards[1].id = cards[0].id;
  expect(() =>
    compileJsonGame(manifest, document, {
      'content/catalogue.json': { ...catalogue, cards },
    }),
  ).toThrow(/duplicate value/);
});
