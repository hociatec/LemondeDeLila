import { publicDomainCardsRules } from './public-domain-cards.recipes';
import type { PublicDomainCardsProgram } from './program';

it('keeps each factory configuration and card catalogue isolated from later mutations', () => {
  const source: PublicDomainCardsProgram = {
    collectibleCategories: ['tresor'],
    lossCategory: 'tresor',
    deckId: 'first-deck',
    handId: 'first-hand',
    inventoryId: 'domain',
    discardNextDrawStatus: 'discard-next',
    handLimit: 3,
    finishReason: 'complete',
    eventNamespace: 'domain',
    cards: [
      {
        id: 'coin',
        name: 'Coin',
        category: 'tresor',
        description: '',
        effects: [],
      },
    ],
  };
  const first = publicDomainCardsRules(source);
  source.deckId = 'second-deck';
  source.handId = 'second-hand';
  source.cards[0].category = 'event';
  const second = publicDomainCardsRules(source);
  source.deckId = 'mutated-deck';
  source.cards[0].id = 'mutated-card';
  const ctx = {
    players: { current: () => ({ id: 1 }) },
    cards: {
      drawOrRecycle: jest.fn(() => 'coin'),
      give: jest.fn(),
      discard: jest.fn(),
    },
    effects: {
      recordSource: jest.fn(),
      schedule: jest.fn(),
      sourcePlayerId: () => 1,
    },
    events: { message: jest.fn() },
    status: { consume: () => false },
  };
  first.lifecycle.beforeTurn({ ctx: ctx as never });
  expect(ctx.cards.drawOrRecycle).toHaveBeenLastCalledWith('first-deck');
  expect(ctx.cards.give).toHaveBeenLastCalledWith('first-hand', 1, 'coin');
  second.lifecycle.beforeTurn({ ctx: ctx as never });
  expect(ctx.cards.drawOrRecycle).toHaveBeenLastCalledWith('second-deck');
  expect(ctx.cards.discard).toHaveBeenLastCalledWith('second-deck', 'coin');
  expect(ctx.cards.give).toHaveBeenCalledTimes(1);
  first.lifecycle.beforeTurn({ ctx: ctx as never });
  expect(ctx.cards.give).toHaveBeenLastCalledWith('first-hand', 1, 'coin');
});
