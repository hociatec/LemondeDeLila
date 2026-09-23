import { copyState } from '../contracts/state-copy';
import type { EngineKitsState } from './declarative-state';

it('requires owner capabilities for nested writes while allowing independent copies', () => {
  const original: EngineKitsState = {
    movement: { positions: { path: { '1': 2 } } },
    cards: {
      decks: { deck: ['a'] },
      discards: {},
      hands: {},
      zones: {},
      completedSets: {},
      deckLifecycles: {},
    },
  };
  const copy = copyState(original);
  if (!copy.movement || !copy.cards) throw new Error('Missing fixture kits');
  copy.movement.positions.path['1'] = 7;
  copy.cards.decks.deck.push('b');
  expect(original.movement?.positions.path['1']).toBe(2);
  expect(original.cards?.decks.deck).toEqual(['a']);
  // Compile-only checks: even aliases of nested containers remain readonly.
  const denied = () => {
    if (!original.movement || !original.cards) return;
    const positions = original.movement.positions.path;
    // @ts-expect-error Direct position mutation requires the owning controller.
    positions['1'] = 3;
    // @ts-expect-error Nested arrays do not expose mutation commands.
    original.cards.decks.deck.push('x');
    // @ts-expect-error Replacing a kit bypasses controller ownership.
    original.movement = { positions: {} };
  };
  expect(typeof denied).toBe('function');
});
