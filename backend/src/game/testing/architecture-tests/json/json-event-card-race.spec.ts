import { compileJsonGame } from '../../../rules/public-api';
import manifest from '../../../games/les-quatre-vents/aventure-sauvage/manifest.json';
import documentSource from '../../../games/les-quatre-vents/aventure-sauvage/game.json';
import board from '../../../games/les-quatre-vents/aventure-sauvage/content/board.json';
import cards from '../../../games/les-quatre-vents/aventure-sauvage/content/cards.json';
import pawns from '../../../games/les-quatre-vents/aventure-sauvage/content/pawns.json';

const assets = {
  'content/board.json': board,
  'content/cards.json': cards,
  'content/pawns.json': pawns,
};

it.each([
  { playingPhase: 'missing' },
  { pawnSelection: { setId: 'missing', choiceId: 'pawn' } },
])('rejects invalid event-card race references %j', (change) => {
  const document = structuredClone(documentSource);
  Object.assign(document.patterns[1], change);
  expect(() => compileJsonGame(manifest, document, assets)).toThrow();
});

it('validates event decks and resolved modular tiles', () => {
  expect(() =>
    compileJsonGame(manifest, documentSource, {
      ...assets,
      'content/board.json': board.map((tile, index) =>
        index === 0 ? { ...tile, deckId: 'missing' } : tile,
      ),
    }),
  ).toThrow();
  expect(() =>
    compileJsonGame(manifest, documentSource, {
      ...assets,
      'content/cards.json': { ...cards, animal: [{ id: 1 }] },
    }),
  ).toThrow();
});
