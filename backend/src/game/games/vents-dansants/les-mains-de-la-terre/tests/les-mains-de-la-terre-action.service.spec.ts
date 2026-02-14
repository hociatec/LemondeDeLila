import { GameCoreService } from '../../../../core/services/game-core.service';
import { RandomService } from '../../../../modules/random/services/random.service';
import { DeckPoliciesService } from '../../../../modules/deck-policies/services/deck-policies.service';
import { TurnFlowService } from '../../../../modules/turn/services/turn-flow.service';
import { TurnService } from '../../../../modules/turn/services/turn.service';
import { LesMainsActionService } from '../actions/les-mains-de-la-terre-action.service';

describe('LesMainsActionService draw behavior', () => {
  const makeService = () => {
    const random = new RandomService();
    const deckPolicies = new DeckPoliciesService(random);
    return new LesMainsActionService(
      new GameCoreService(),
      new TurnFlowService(new TurnService()),
      random,
      deckPolicies,
    ) as any;
  };

  it('draws first card from deck', () => {
    const service = makeService();
    const out = service.drawOneCard({
      deck: ['a', 'b'],
      discard: [],
      rng: { seed: 1, counter: 0 },
    });

    expect(out.cardId).toBe('a');
    expect(out.meta.deck).toEqual(['b']);
    expect(out.meta.discard).toEqual([]);
  });

  it('reshuffles discard when deck is empty', () => {
    const service = makeService();
    const out = service.drawOneCard({
      deck: [],
      discard: ['x', 'y'],
      rng: { seed: 3, counter: 0 },
    });

    expect(out.cardId).not.toBeNull();
    expect(Array.isArray(out.meta.deck)).toBe(true);
    expect(out.meta.discard).toEqual([]);
  });
});
