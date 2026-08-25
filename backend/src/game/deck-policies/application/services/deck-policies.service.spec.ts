import { RandomService } from '../../../core/application/services/random.service';
import { DeckPoliciesService } from './deck-policies.service';

describe('DeckPoliciesService', () => {
  let service: DeckPoliciesService;

  beforeEach(() => {
    service = new DeckPoliciesService(new RandomService());
  });

  it('draws from deck without reshuffle when deck has cards', () => {
    const out = service.drawOne<string>({
      meta: {
        deck: ['a', 'b'],
        discard: ['x'],
        rng: { seed: 1, counter: 0 },
      },
      deckKey: 'deck',
      discardKey: 'discard',
      rngKey: 'rng',
    });

    expect(out.card).toBe('a');
    expect(out.reshuffled).toBe(false);
    expect(out.meta.deck).toEqual(['b']);
    expect(out.meta.discard).toEqual(['x']);
  });

  it('reshuffles discard into deck when deck is empty', () => {
    const out = service.drawOne<string>({
      meta: {
        deck: [],
        discard: ['x', 'y', 'z'],
        rng: { seed: 7, counter: 0 },
      },
      deckKey: 'deck',
      discardKey: 'discard',
      rngKey: 'rng',
    });

    expect(out.card).not.toBeNull();
    expect(out.reshuffled).toBe(true);
    expect(Array.isArray(out.meta.deck)).toBe(true);
    expect(Array.isArray(out.meta.discard)).toBe(true);
    expect(out.meta.discard.length).toBe(0);
  });

  it('returns null card when both deck and discard are empty', () => {
    const out = service.drawOne<string>({
      meta: {
        deck: [],
        discard: [],
        rng: { seed: 1, counter: 0 },
      },
      deckKey: 'deck',
      discardKey: 'discard',
      rngKey: 'rng',
    });

    expect(out.card).toBeNull();
    expect(out.meta.deck).toEqual([]);
    expect(out.meta.discard).toEqual([]);
  });

  it('supports whole-meta rng reshuffle and puts drawn card in discard when requested', () => {
    const out = service.drawFromPile<string, any>({
      meta: { seed: 42, counter: 0 },
      pile: [],
      discard: ['a', 'b'],
      useWholeMetaRng: true,
      discardDrawnCard: true,
    });

    expect(out.card).not.toBeNull();
    expect(out.reshuffled).toBe(true);
    expect(Array.isArray(out.discard)).toBe(true);
    expect(out.discard.length).toBe(1);
    expect(typeof out.meta.counter).toBe('number');
  });
});
