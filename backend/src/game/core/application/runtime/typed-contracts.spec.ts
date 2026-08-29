import { cards } from './cards/cards-contracts';
import type { GameSetupPlayerViewFor } from './projection/game-system-view';
import type { PlayerValuesKitState } from './kits/player-values-kit';
import { defineCardsSchema, type CardOfDeck } from './cards/typed-cards';

describe('typed game contracts', () => {
  const schema = defineCardsSchema({
    decks: {
      main: cards.deck({
        id: 'main',
        cards: [{ id: 'sun', power: 3 }] as const,
      }),
    },
    hands: {
      player: cards.hands({
        id: 'player',
        deck: 'main',
        initial: 1,
        visibility: 'owner',
      }) as ReturnType<typeof cards.hands> & { readonly deck: 'main' },
    },
  });

  it('keeps exact deck, hand, resource, counter and setup value types', () => {
    type Card = CardOfDeck<typeof schema.decks, 'main'>;
    const card: Card = { id: 'sun', power: 3 };
    type Values = PlayerValuesKitState<'energy' | 'water', 'round'>;
    const values: Values = {
      scores: {},
      resources: { energy: {}, water: {} },
      counters: { round: 1 },
      statuses: {},
      turnFlags: {},
      scheduledSkips: {},
      scheduledExtraTurns: {},
    };
    type Setup = GameSetupPlayerViewFor<{
      config: { defaults: { timerSeconds: number; teams: boolean } };
    }>;
    const setup: Setup = {
      complete: false,
      phase: 'setup',
      ownerPlayerId: 1,
      values: { timerSeconds: 30, teams: true },
    };

    expect(schema.components).toHaveLength(2);
    expect(card.power).toBe(3);
    expect(values.resources.energy).toEqual({});
    expect(setup.values.timerSeconds).toBe(30);
  });
});
