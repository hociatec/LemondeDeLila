import {
  DeckPoolService,
  DeckPoolState,
} from '../../../../../cards/public-api';
import {
  PanierExpressDeckPool,
  PanierExpressMetadata,
} from '../../model/panier-express-state.model';
import { RandomService } from '../../../../../core/application/services/random.service';

export class PanierExpressDeckService {
  constructor(
    private readonly deckPool: DeckPoolService,
    private readonly random: RandomService,
  ) {}

  drawCard<T = string>(
    meta: PanierExpressMetadata,
    key: string,
  ): {
    card: T | null;
    metadata: PanierExpressMetadata;
  } {
    const metaRng = this.random.createMetaRng(meta);
    const { card, pool } = this.deckPool.draw<T>(
      meta.decks as DeckPoolState<T>,
      key,
      metaRng.rng,
    );
    return {
      card: card ?? null,
      metadata: {
        ...metaRng.getMeta(),
        decks: pool as PanierExpressDeckPool,
      },
    };
  }

  drawWithReplenish<T = string>(
    meta: PanierExpressMetadata,
    key: string,
    replenish: () => T[],
  ): {
    card: T | null;
    metadata: PanierExpressMetadata;
  } {
    const initial = this.drawCard<T>(meta, key);
    if (initial.card) {
      return initial;
    }
    const cards = replenish();
    if (!Array.isArray(cards) || cards.length === 0) {
      return initial;
    }
    const replenished = this.replenishDeck(meta, key, cards);
    return this.drawCard<T>(replenished, key);
  }

  replenishDeck<T = string>(
    meta: PanierExpressMetadata,
    key: string,
    cards: T[],
  ): PanierExpressMetadata {
    const metaRng = this.random.createMetaRng(meta);
    const pool = this.deckPool.set<T>(
      meta.decks as DeckPoolState<T>,
      key,
      this.deckPool.shuffle([...cards], metaRng.rng),
    );
    return {
      ...metaRng.getMeta(),
      decks: pool as PanierExpressDeckPool,
    };
  }
}
