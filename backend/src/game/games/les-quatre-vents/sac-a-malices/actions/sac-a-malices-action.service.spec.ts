/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call */
import { GameCoreService } from '../../../../core/services/game-core.service';
import { RandomService } from '../../../../modules/random/services/random.service';
import { DeckPoliciesService } from '../../../../modules/deck-policies/services/deck-policies.service';
import { SacAMalicesActionService } from './sac-a-malices-action.service';

describe('SacAMalicesActionService draw deck behavior', () => {
  const makeService = () => {
    const random = new RandomService();
    const core = new GameCoreService();
    const setup: any = {};
    const deckPolicies = new DeckPoliciesService(random);
    return new SacAMalicesActionService(random, core, setup, deckPolicies);
  };

  it('keeps get-out-of-jail card out of discard', () => {
    const service = makeService() as any;
    const meta: any = {
      seed: 11,
      counter: 0,
      decks: {
        chance: {
          cards: [{ id: 1, text: 'Carte sortie de prison', title: 'Sortie' }],
          discard: [],
        },
      },
    };

    const out = service.drawCard(meta, 'chance');
    expect(out.card?.id).toBe(1);
    expect(out.meta.decks.chance.cards).toEqual([]);
    expect(out.meta.decks.chance.discard).toEqual([]);
  });

  it('puts normal drawn card in discard', () => {
    const service = makeService() as any;
    const meta: any = {
      seed: 21,
      counter: 0,
      decks: {
        chance: {
          cards: [{ id: 2, text: 'Payez 50 euros', title: 'Amende' }],
          discard: [],
        },
      },
    };

    const out = service.drawCard(meta, 'chance');
    expect(out.card?.id).toBe(2);
    expect(out.meta.decks.chance.cards).toEqual([]);
    expect(out.meta.decks.chance.discard.map((c: any) => c.id)).toEqual([2]);
  });
});
