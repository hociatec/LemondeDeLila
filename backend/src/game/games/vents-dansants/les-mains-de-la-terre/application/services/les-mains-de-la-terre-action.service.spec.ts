import { GameCoreService } from '../../../../../core/application/services/game-core.service';
import { RandomService } from '../../../../../core/application/services/random.service';
import { DeckPoliciesService } from '../../../../../deck-policies/application/services/deck-policies.service';
import { TurnFlowService } from '../../../../../core/application/services/turn-flow.service';
import { TurnService } from '../../../../../core/application/services/turn.service';
import { TurnPoliciesService } from '../../../../../core/application/services/turn-policies.service';
import { LesMainsActionService } from '../../application/services/les-mains-de-la-terre-action.service';

describe('LesMainsActionService draw behavior', () => {
  const makeService = () => {
    const core = new GameCoreService();
    const random = new RandomService();
    const deckPolicies = new DeckPoliciesService(random);
    return new LesMainsActionService(
      core,
      new TurnFlowService(new TurnService(), new TurnPoliciesService(core)),
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








