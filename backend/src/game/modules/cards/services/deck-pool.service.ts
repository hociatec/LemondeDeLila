import { Injectable } from '@nestjs/common';

export type DeckPoolState<T = any> = Record<
  string,
  { deck: T[]; discards: T[] }
>;

@Injectable()
export class DeckPoolService {
  shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  draw<T>(
    pool: DeckPoolState<T>,
    key: string,
    rng: () => number = Math.random,
  ): { card: T | null; pool: DeckPoolState<T> } {
    const state = pool[key] ?? { deck: [], discards: [] };
    let deck = [...state.deck];
    let discards = [...state.discards];
    if (deck.length === 0 && discards.length > 0) {
      deck = this.shuffle(discards, rng);
      discards = [];
    }
    if (deck.length === 0) {
      return { card: null, pool: pool };
    }
    const [card, ...rest] = deck;
    const updated: DeckPoolState<T> = {
      ...pool,
      [key]: { deck: rest, discards },
    };
    return { card, pool: updated };
  }

  discard<T>(pool: DeckPoolState<T>, key: string, card: T): DeckPoolState<T> {
    const state = pool[key] ?? { deck: [], discards: [] };
    return {
      ...pool,
      [key]: { deck: state.deck, discards: [...state.discards, card] },
    };
  }

  set<T>(
    pool: DeckPoolState<T>,
    key: string,
    deck: T[],
    discards: T[] = [],
  ): DeckPoolState<T> {
    return { ...pool, [key]: { deck, discards } };
  }
}
