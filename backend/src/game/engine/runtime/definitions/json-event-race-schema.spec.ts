import { compileJsonGame } from './json-game-compiler';
import manifest from '../../../games/les-quatre-vents/aventure-sauvage/manifest.json';
import document from '../../../games/les-quatre-vents/aventure-sauvage/game.json';
import board from '../../../games/les-quatre-vents/aventure-sauvage/content/board.json';
import cards from '../../../games/les-quatre-vents/aventure-sauvage/content/cards.json';
import pawns from '../../../games/les-quatre-vents/aventure-sauvage/content/pawns.json';

const assets = {
  'content/board.json': board,
  'content/cards.json': cards,
  'content/pawns.json': pawns,
};

it.each([
  { trackId: 'missing' },
  { diceId: 'missing' },
  { playingPhase: 'setup' },
  { playingPhase: 'missing' },
  { pawnSelection: { setId: 'missing', choiceId: 'pawn' } },
  { tiles: [{ label: 'A' }, { label: 'B' }] },
])('rejects invalid event race references %j', (program) => {
  expect(() =>
    compileJsonGame(
      manifest,
      { ...document, eventRace: { ...document.eventRace, ...program } },
      assets,
    ),
  ).toThrow();
});

it('validates references inside resolved modular tiles', () => {
  expect(() =>
    compileJsonGame(manifest, document, {
      ...assets,
      'content/board.json': board.map((tile, index) =>
        index === 0 ? { ...tile, deckId: 'missing' } : tile,
      ),
    }),
  ).toThrow();
});

it('requires event cards with effects and a finish rule', () => {
  expect(() =>
    compileJsonGame(manifest, document, {
      ...assets,
      'content/cards.json': { ...cards, animal: [{ id: 1 }] },
    }),
  ).toThrow();
  expect(() =>
    compileJsonGame(
      manifest,
      {
        ...document,
        patterns: document.patterns.map((pattern) => ({
          ...pattern,
          winOnFinish: false,
        })),
      },
      assets,
    ),
  ).toThrow();
});

it('accepts explicit setup for an event race', () => {
  expect(() =>
    compileJsonGame(
      manifest,
      { ...document, setup: { firstPlayer: 'random' } },
      assets,
    ),
  ).not.toThrow();
});

it('refuses an event card declaring another source deck', () => {
  expect(() =>
    compileJsonGame(manifest, document, {
      ...assets,
      'content/cards.json': {
        ...cards,
        animal: cards.animal.map((card) => ({ ...card, deck: 'patte' })),
      },
    }),
  ).toThrow();
});
