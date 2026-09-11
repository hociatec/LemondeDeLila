import type { GameState } from '../../../core/application/models/game-state.model';
import { assertContentReferences } from './game-content-storage-auditor';

function snapshot(engine: object): GameState & { engine: object } {
  return { status: 'started', phase: 'playing', log: [], engine };
}

function session(card: unknown, location: string): GameState {
  const collections = { decks: {}, discards: {}, zones: {}, hands: {} };
  return snapshot({
    kits: {
      cards: {
        ...collections,
        [location]:
          location === 'hands' ? { main: { 1: [card] } } : { main: [card] },
      },
    },
  });
}

it.each(['decks', 'discards', 'hands', 'zones'])(
  'rejects copied catalogue objects in persisted %s',
  (location) => {
    expect(() =>
      assertContentReferences(session('card-id', location)),
    ).not.toThrow();
    expect(() => assertContentReferences(session(42, location))).not.toThrow();
    expect(() =>
      assertContentReferences(
        session({ id: 'card-id', title: 'Static text' }, location),
      ),
    ).toThrow('static catalogue content');
  },
);

it('rejects a hydrated question or complete catalogue in persisted state', () => {
  const quiz = {
    questionId: 'question-id',
    question: { prompt: 'Static text' },
  };
  expect(() =>
    assertContentReferences(
      snapshot({ kits: { quiz: { sessions: { quiz } } } }),
    ),
  ).toThrow('static question content');
  expect(() =>
    assertContentReferences(snapshot({ kits: {}, content: {} })),
  ).toThrow('static content');
});
