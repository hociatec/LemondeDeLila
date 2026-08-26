export type DeckDefinition<TCard> = {
  readonly component: 'cards.deck';
  id: string;
  cards: readonly TCard[];
  shuffle?: boolean;
};

export type HandsDefinition = {
  readonly component: 'cards.hands';
  id: string;
  deck: string;
  initial: number;
  visibility: 'owner' | 'public';
};

export type CardsKitState = {
  decks: Record<string, unknown[]>;
  discards: Record<string, unknown[]>;
  hands: Record<string, Record<string, unknown[]>>;
  handDefinitions: Record<string, HandsDefinition>;
};

export type CardsPlayerView = {
  decks: Record<string, { count: number }>;
  discards: Record<string, { count: number; cards: unknown[] }>;
  hands: Record<
    string,
    {
      visibility: HandsDefinition['visibility'];
      byPlayer: Record<string, unknown[] | { count: number }>;
    }
  >;
};

export const cards = {
  deck<TCard>(
    definition: Omit<DeckDefinition<TCard>, 'component'>,
  ): DeckDefinition<TCard> {
    return Object.freeze({
      ...definition,
      component: 'cards.deck',
      cards: [...definition.cards],
    });
  },

  hands(definition: Omit<HandsDefinition, 'component'>): HandsDefinition {
    return Object.freeze({ ...definition, component: 'cards.hands' });
  },
};

export class GameCardsController {
  constructor(
    private readonly state: CardsKitState,
    private readonly random: { shuffle<T>(values: readonly T[]): T[] },
  ) {}

  createDeck<TCard>(definition: DeckDefinition<TCard>): void {
    const values = [...definition.cards];
    this.state.decks[definition.id] = definition.shuffle
      ? this.random.shuffle(values)
      : values;
    this.state.discards[definition.id] = [];
  }

  createHands(definition: HandsDefinition, playerIds: readonly number[]): void {
    this.state.handDefinitions[definition.id] = structuredClone(definition);
    this.state.hands[definition.id] = Object.fromEntries(
      playerIds.map((playerId) => [String(playerId), []]),
    );
    this.deal(definition.deck, definition.id, playerIds, definition.initial);
  }

  shuffle(deckId: string): void {
    const deck = this.state.decks[deckId];
    if (!deck) throw new Error(`Pioche inconnue: ${deckId}`);
    this.state.decks[deckId] = this.random.shuffle(deck);
  }

  resetDeck<TCard>(
    deckId: string,
    cards: readonly TCard[],
    options: { shuffle?: boolean } = {},
  ): void {
    this.state.decks[deckId] = options.shuffle
      ? this.random.shuffle(cards)
      : [...cards];
    this.state.discards[deckId] = [];
  }

  clearHands(handId: string, playerIds: readonly number[]): void {
    this.state.hands[handId] = Object.fromEntries(
      playerIds.map((playerId) => [String(playerId), []]),
    );
  }

  discard<TCard>(deckId: string, card: TCard): void {
    (this.state.discards[deckId] ??= []).push(card);
  }

  deckCount(deckId: string): number {
    return this.state.decks[deckId]?.length ?? 0;
  }

  discardCount(deckId: string): number {
    return this.state.discards[deckId]?.length ?? 0;
  }

  discardPile<TCard>(deckId: string): TCard[] {
    return structuredClone((this.state.discards[deckId] ?? []) as TCard[]);
  }

  takeDiscard<TCard>(deckId: string, card: TCard): TCard {
    const discard = this.state.discards[deckId] ?? [];
    const index = discard.findIndex((candidate) => Object.is(candidate, card));
    if (index < 0) throw new Error('Carte absente de la défausse');
    const [taken] = discard.splice(index, 1);
    return taken as TCard;
  }

  draw<TCard>(deckId: string): TCard | null {
    const deck = this.state.decks[deckId] ?? [];
    return (deck.shift() as TCard | undefined) ?? null;
  }

  drawOrRecycle<TCard>(deckId: string): TCard | null {
    const card = this.draw<TCard>(deckId);
    if (card != null) return card;
    this.recycle(deckId);
    return this.draw<TCard>(deckId);
  }

  recycle(deckId: string): void {
    const discard = this.state.discards[deckId] ?? [];
    if (discard.length === 0) return;
    this.state.decks[deckId] = this.random.shuffle(discard);
    this.state.discards[deckId] = [];
  }

  putOnTop<TCard>(deckId: string, cards: readonly TCard[]): void {
    const deck = (this.state.decks[deckId] ??= []);
    this.state.decks[deckId] = [...cards, ...deck];
  }

  give<TCard>(handId: string, playerId: number, card: TCard): void {
    const hands = (this.state.hands[handId] ??= {});
    const hand = (hands[String(playerId)] ??= []);
    hand.push(card);
  }

  play<TCard>(
    handId: string,
    deckId: string,
    playerId: number,
    card: TCard,
  ): void {
    const hand = this.hand<TCard>(handId, playerId);
    const index = hand.findIndex((candidate) => Object.is(candidate, card));
    if (index < 0) throw new Error('Carte absente de la main');
    const [played] = hand.splice(index, 1);
    (this.state.discards[deckId] ??= []).push(played);
  }

  hand<TCard>(handId: string, playerId: number): TCard[] {
    const hands = (this.state.hands[handId] ??= {});
    return (hands[String(playerId)] ??= []) as TCard[];
  }

  take<TCard>(handId: string, playerId: number, card: TCard): TCard {
    const hand = this.hand<TCard>(handId, playerId);
    const index = hand.findIndex((candidate) => Object.is(candidate, card));
    if (index < 0) throw new Error('Carte absente de la main');
    const [taken] = hand.splice(index, 1);
    return taken;
  }

  handCounts(handId: string): Record<number, number> {
    const hands = this.state.hands[handId] ?? {};
    return Object.fromEntries(
      Object.entries(hands).map(([playerId, cards]) => [
        Number(playerId),
        cards.length,
      ]),
    );
  }

  deal(
    deckId: string,
    handId: string,
    playerIds: readonly number[],
    count: number,
  ): void {
    for (let round = 0; round < Math.max(0, count); round += 1) {
      for (const playerId of playerIds) {
        const card = this.draw(deckId);
        if (card == null) return;
        this.give(handId, playerId, card);
      }
    }
  }
}

export function createCardsKitState(): CardsKitState {
  return { decks: {}, discards: {}, hands: {}, handDefinitions: {} };
}

export function projectCardsKitState(
  state: CardsKitState,
  viewerPlayerId: number | null,
): CardsPlayerView {
  return {
    decks: Object.fromEntries(
      Object.entries(state.decks).map(([id, cards]) => [
        id,
        { count: cards.length },
      ]),
    ),
    discards: Object.fromEntries(
      Object.entries(state.discards).map(([id, cards]) => [
        id,
        { count: cards.length, cards: structuredClone(cards) },
      ]),
    ),
    hands: Object.fromEntries(
      Object.entries(state.hands).map(([id, byPlayer]) => {
        const definition = state.handDefinitions[id];
        const visibility = definition?.visibility ?? 'owner';
        return [
          id,
          {
            visibility,
            byPlayer: Object.fromEntries(
              Object.entries(byPlayer).map(([playerId, cards]) => [
                playerId,
                visibility === 'public' || Number(playerId) === viewerPlayerId
                  ? structuredClone(cards)
                  : { count: cards.length },
              ]),
            ),
          },
        ];
      }),
    ),
  };
}
