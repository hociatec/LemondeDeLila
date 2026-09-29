import { compileJsonGame } from '../../../rules/public-api';
import manifest from '../../../games/vents-dansants/la-parade-sucree/manifest.json';
import documentSource from '../../../games/vents-dansants/la-parade-sucree/game.json';
import catalogue from '../../../games/vents-dansants/la-parade-sucree/content/catalogue.json';

const assets = { 'content/catalogue.json': catalogue };
type MutablePattern = {
  sequence: string[];
  cards: Array<{ value: string }>;
};

it('rejects an empty ordered sequence', () => {
  const document = structuredClone(documentSource);
  (document.patterns[0] as unknown as MutablePattern).sequence = [];
  expect(() => compileJsonGame(manifest, document, assets)).toThrow(
    /patterns\[0\].sequence/,
  );
});

it('rejects duplicate card values before registration', () => {
  const document = structuredClone(documentSource);
  const pattern = document.patterns[0] as unknown as MutablePattern;
  pattern.cards = structuredClone(catalogue.cards);
  pattern.cards[1].value = pattern.cards[0].value;
  expect(() => compileJsonGame(manifest, document, assets)).toThrow(
    /patterns\[0\].cards\[1\].value/,
  );
});
