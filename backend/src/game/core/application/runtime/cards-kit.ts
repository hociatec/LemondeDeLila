import {
  GameConfigurationError,
  GameNotFoundError,
  GameRuleViolationError,
  GameStateViolationError,
} from '../../domain/errors/game-domain.errors';
import type { GameRng } from '../models/game-execution-context.model';
import type { EventVisibility } from '../models/game-event.model';

export type CardId = string | number;
export type CardDefinition<
  TCard extends CardId | { id: CardId } = { id: CardId },
> = TCard;

export type CardInstance<TCard> = TCard;

export type CardZone<TCard> = ReadonlyArray<CardInstance<TCard>>;

export type DeckDefinition<TCard> = {
  readonly component: 'cards.deck';
  id: string;
  cards: readonly TCard[];
  shuffle?: boolean;
  empty?: 'exhaust' | 'recycle';
};

export type DeckLifecycleState = {
  empty: 'exhaust' | 'recycle';
  exhausted: boolean;
};

export type HandsDefinition = {
  readonly component: 'cards.hands';
  id: string;
  deck: string;
  initial: number;
  visibility: 'owner' | 'public';
};

export type CardSetsDefinition<TCardId extends string = string> = {
  readonly component: 'cards.sets';
  id: string;
  hand: string;
  deck: string;
  sets: Readonly<Record<string, readonly TCardId[]>>;
  visibility?: 'owner' | 'public';
};

export type CardsKitState = {
  decks: Record<string, unknown[]>;
  discards: Record<string, unknown[]>;
  deckLifecycles: Record<string, DeckLifecycleState>;
  hands: Record<string, Record<string, unknown[]>>;
  completedSets: Record<string, Record<string, string[]>>;
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
  collections: Record<
    string,
    {
      visibility: 'owner' | 'public';
      byPlayer: Record<string, string[] | { count: number }>;
    }
  >;
};

type CardContentId = CardId;

type CardCatalog = {
  readonly cardsById: ReadonlyMap<string, unknown>;
};

export const cards = {
  deck<TCard>(
    definition: Omit<DeckDefinition<TCard>, 'component'>,
  ): DeckDefinition<TCard> {
    const identifiedCards = definition.cards.filter(isIdentifiedCard);
    if (
      identifiedCards.length > 0 &&
      identifiedCards.length !== definition.cards.length
    ) {
      throw new GameConfigurationError(
        `La pioche ${definition.id} mélange références de contenu et valeurs libres`,
      );
    }
    const identifiedIds = identifiedCards.map((card) => contentIdKey(card.id));
    if (new Set(identifiedIds).size !== identifiedIds.length) {
      throw new GameConfigurationError(
        `La pioche ${definition.id} contient des identifiants de carte dupliqués`,
      );
    }
    return deepFreeze({
      ...definition,
      component: 'cards.deck',
      cards: structuredClone(definition.cards),
    });
  },

  hands(definition: Omit<HandsDefinition, 'component'>): HandsDefinition {
    return Object.freeze({ ...definition, component: 'cards.hands' });
  },

  sets<TCardId extends string>(
    definition: Omit<CardSetsDefinition<TCardId>, 'component'>,
  ): CardSetsDefinition<TCardId> {
    return Object.freeze({
      ...definition,
      component: 'cards.sets',
      sets: Object.freeze(
        Object.fromEntries(
          Object.entries(definition.sets).map(([setId, cardIds]) => [
            setId,
            Object.freeze([...cardIds]),
          ]),
        ),
      ),
    });
  },
};

export class GameCardsController {
  constructor(
    private readonly state: CardsKitState,
    private readonly random: Pick<GameRng, 'pick' | 'shuffle'>,
    private readonly emit: (
      type: string,
      data: Record<string, unknown>,
      visibility?: EventVisibility,
    ) => void = () => {},
    definitions: readonly (
      DeckDefinition<unknown> | HandsDefinition | CardSetsDefinition
    )[] = [],
  ) {
    for (const definition of definitions) this.registerDefinition(definition);
    const legacy = this.state as CardsKitState & {
      handDefinitions?: Record<string, HandsDefinition>;
      setDefinitions?: Record<string, CardSetsDefinition>;
    };
    for (const definition of Object.values(legacy.handDefinitions ?? {})) {
      this.handDefinitions.set(definition.id, definition);
    }
    for (const definition of Object.values(legacy.setDefinitions ?? {})) {
      this.setDefinitions.set(definition.id, definition);
    }
    delete legacy.handDefinitions;
    delete legacy.setDefinitions;
    for (const [deckId, deck] of Object.entries(this.state.decks)) {
      this.state.decks[deckId] = deck.map((card) =>
        this.toPersistentCard(deckId, card),
      );
      this.state.discards[deckId] = (this.state.discards[deckId] ?? []).map(
        (card) => this.toPersistentCard(deckId, card),
      );
    }
    for (const [handId, byPlayer] of Object.entries(this.state.hands)) {
      const deckId = this.handDefinitions.get(handId)?.deck;
      if (!deckId) continue;
      for (const [playerId, hand] of Object.entries(byPlayer)) {
        byPlayer[playerId] = hand.map((card) =>
          this.toPersistentCard(deckId, card),
        );
      }
    }
  }

  private readonly catalogs = new Map<string, CardCatalog>();
  private readonly handDefinitions = new Map<string, HandsDefinition>();
  private readonly setDefinitions = new Map<string, CardSetsDefinition>();

  createDeck<TCard>(definition: DeckDefinition<TCard>): void {
    this.registerCatalog(definition);
    const values = definition.cards.map((card) =>
      this.toPersistentCard(definition.id, card),
    );
    this.state.decks[definition.id] = definition.shuffle
      ? this.random.shuffle(values)
      : values;
    this.state.discards[definition.id] = [];
    this.state.deckLifecycles[definition.id] = {
      empty: definition.empty ?? 'exhaust',
      exhausted: false,
    };
  }

  createHands(definition: HandsDefinition, playerIds: readonly number[]): void {
    this.handDefinitions.set(definition.id, definition);
    this.state.hands[definition.id] = Object.fromEntries(
      playerIds.map((playerId) => [String(playerId), []]),
    );
    this.deal(definition.deck, definition.id, playerIds, definition.initial);
  }

  createSets(
    definition: CardSetsDefinition,
    playerIds: readonly number[],
  ): void {
    this.setDefinitions.set(definition.id, definition);
    this.state.completedSets[definition.id] = Object.fromEntries(
      playerIds.map((playerId) => [String(playerId), []]),
    );
  }

  removeDeck(deckId: string): void {
    delete this.state.decks[deckId];
    delete this.state.discards[deckId];
    delete this.state.deckLifecycles[deckId];
    this.catalogs.delete(deckId);
  }

  resetHands(handId: string): void {
    delete this.state.hands[handId];
    this.handDefinitions.delete(handId);
  }

  resetSets(collectionId: string): void {
    delete this.state.completedSets[collectionId];
    this.setDefinitions.delete(collectionId);
  }

  assertValid(): void {
    for (const [deckId, deck] of Object.entries(this.state.decks)) {
      if (!Array.isArray(deck) || !Array.isArray(this.state.discards[deckId])) {
        throw new GameStateViolationError('État de pioche invalide', {
          deckId,
        });
      }
      if (!this.state.deckLifecycles[deckId]) {
        throw new GameStateViolationError('Cycle de pioche absent', { deckId });
      }
    }
    for (const [handId, definition] of Object.entries(
      Object.fromEntries(this.handDefinitions),
    )) {
      const hands = this.state.hands[handId];
      if (!hands || !this.state.decks[definition.deck]) {
        throw new GameStateViolationError('État de main invalide', {
          handId,
          deckId: definition.deck,
        });
      }
      if (Object.values(hands).some((hand) => !Array.isArray(hand))) {
        throw new GameStateViolationError('Contenu de main invalide', {
          handId,
        });
      }
    }
    for (const [collectionId, definition] of Object.entries(
      Object.fromEntries(this.setDefinitions),
    )) {
      if (
        !this.state.completedSets[collectionId] ||
        !this.state.hands[definition.hand] ||
        !this.state.decks[definition.deck]
      ) {
        throw new GameStateViolationError('Collection de cartes invalide', {
          collectionId,
        });
      }
    }
  }

  shuffle(deckId: string): void {
    const deck = this.state.decks[deckId];
    if (!deck) throw new GameNotFoundError(`Pioche inconnue: ${deckId}`);
    this.state.decks[deckId] = this.random.shuffle(deck);
  }

  resetDeck<TCard>(
    deckId: string,
    cards: readonly TCard[],
    options: { shuffle?: boolean } = {},
  ): void {
    this.registerCatalog({
      component: 'cards.deck',
      id: deckId,
      cards,
    });
    const persistentCards = cards.map((card) =>
      this.toPersistentCard(deckId, card),
    );
    this.state.decks[deckId] = options.shuffle
      ? this.random.shuffle(persistentCards)
      : persistentCards;
    this.state.discards[deckId] = [];
    const lifecycle = this.lifecycle(deckId);
    lifecycle.exhausted = false;
  }

  clearHands(handId: string, playerIds: readonly number[]): void {
    this.state.hands[handId] = Object.fromEntries(
      playerIds.map((playerId) => [String(playerId), []]),
    );
  }

  discard<TCard>(deckId: string, card: TCard): void {
    (this.state.discards[deckId] ??= []).push(
      this.toPersistentCard(deckId, card),
    );
    this.emit('card.discarded', { deckId, card });
  }

  deckCount(deckId: string): number {
    return this.state.decks[deckId]?.length ?? 0;
  }

  discardCount(deckId: string): number {
    return this.state.discards[deckId]?.length ?? 0;
  }

  discardPile<TCard>(deckId: string): TCard[] {
    return (this.state.discards[deckId] ?? []).map((card) =>
      this.fromPersistentCard<TCard>(deckId, card),
    );
  }

  takeDiscard<TCard>(deckId: string, card: TCard): TCard {
    const discard = this.state.discards[deckId] ?? [];
    const persistentCard = this.toPersistentCard(deckId, card);
    const index = discard.findIndex((candidate) =>
      Object.is(candidate, persistentCard),
    );
    if (index < 0) {
      throw new GameRuleViolationError(
        'CARD_NOT_IN_DISCARD',
        { deckId },
        'Carte absente de la défausse',
      );
    }
    const [taken] = discard.splice(index, 1);
    return this.fromPersistentCard<TCard>(deckId, taken);
  }

  draw<TCard>(deckId: string): TCard | null {
    const lifecycle = this.lifecycle(deckId);
    let card = this.drawOne<TCard>(deckId);
    if (card == null && lifecycle.empty === 'recycle') {
      this.recycle(deckId);
      card = this.drawOne<TCard>(deckId);
    }
    if (card == null) this.markExhausted(deckId);
    return card;
  }

  drawOrRecycle<TCard>(deckId: string): TCard | null {
    let card = this.drawOne<TCard>(deckId);
    if (card != null) return card;
    this.recycle(deckId);
    card = this.drawOne<TCard>(deckId);
    if (card == null) this.markExhausted(deckId);
    return card;
  }

  drawToHand<TCard>(
    deckId: string,
    handId: string,
    playerId: number,
    options: { recycle?: boolean } = {},
  ): TCard | null {
    const card = options.recycle
      ? this.drawOrRecycle<TCard>(deckId)
      : this.draw<TCard>(deckId);
    if (card != null) this.give(handId, playerId, card);
    return card;
  }

  drawManyToHand<TCard>(
    deckId: string,
    handId: string,
    playerId: number,
    count: number,
    options: { recycle?: boolean } = {},
  ): TCard[] {
    const drawn: TCard[] = [];
    for (let index = 0; index < Math.max(0, count); index += 1) {
      const card = this.drawToHand<TCard>(deckId, handId, playerId, options);
      if (card == null) break;
      drawn.push(card);
    }
    return drawn;
  }

  drawThenResolve<TCard, TResult>(
    deckId: string,
    resolve: (card: TCard) => TResult,
    options: {
      recycle?: boolean;
      discard?:
        boolean | ((input: { card: TCard; result: TResult }) => boolean);
    } = {},
  ): TResult | null {
    const card = options.recycle
      ? this.drawOrRecycle<TCard>(deckId)
      : this.draw<TCard>(deckId);
    if (card == null) return null;
    const result = resolve(card);
    const shouldDiscard =
      typeof options.discard === 'function'
        ? options.discard({ card, result })
        : (options.discard ?? true);
    if (shouldDiscard) this.discard(deckId, card);
    return result;
  }

  recycle(deckId: string): void {
    const discard = this.state.discards[deckId] ?? [];
    if (discard.length === 0) return;
    const count = discard.length;
    this.state.decks[deckId] = this.random.shuffle(discard);
    this.state.discards[deckId] = [];
    this.lifecycle(deckId).exhausted = false;
    this.emit('deck.recycled', { deckId, count });
  }

  putOnTop<TCard>(deckId: string, cards: readonly TCard[]): void {
    const deck = (this.state.decks[deckId] ??= []);
    this.state.decks[deckId] = [
      ...cards.map((card) => this.toPersistentCard(deckId, card)),
      ...deck,
    ];
    if (cards.length > 0) this.lifecycle(deckId).exhausted = false;
  }

  give<TCard>(handId: string, playerId: number, card: TCard): void {
    const hands = (this.state.hands[handId] ??= {});
    const hand = (hands[String(playerId)] ??= []);
    const deckId = this.handDefinitions.get(handId)?.deck;
    hand.push(deckId ? this.toPersistentCard(deckId, card) : card);
    this.emit(
      'card.received',
      { handId, playerId },
      {
        kind: 'split',
        privateDataByPlayer: { [String(playerId)]: { card } },
      },
    );
  }

  play<TCard>(
    handId: string,
    deckId: string,
    playerId: number,
    card: TCard,
  ): void {
    const hand = this.persistentHand(handId, playerId);
    const persistentCard = this.toPersistentCard(deckId, card);
    const index = hand.findIndex((candidate) =>
      Object.is(candidate, persistentCard),
    );
    if (index < 0) {
      throw new GameRuleViolationError(
        'CARD_NOT_IN_HAND',
        { handId, playerId },
        'Carte absente de la main',
      );
    }
    const [played] = hand.splice(index, 1);
    (this.state.discards[deckId] ??= []).push(played);
    this.emit('card.played', {
      handId,
      deckId,
      playerId,
      card: this.fromPersistentCard(deckId, played),
    });
  }

  hand<TCard>(handId: string, playerId: number): TCard[] {
    const deckId = this.handDefinitions.get(handId)?.deck;
    const hand = this.persistentHand(handId, playerId);
    if (!deckId) return structuredClone(hand) as TCard[];
    return hand.map((card) => this.fromPersistentCard<TCard>(deckId, card));
  }

  take<TCard>(handId: string, playerId: number, card: TCard): TCard {
    const definition = this.handDefinitions.get(handId);
    const hand = this.persistentHand(handId, playerId);
    const persistentCard = definition
      ? this.toPersistentCard(definition.deck, card)
      : card;
    const index = hand.findIndex((candidate) =>
      Object.is(candidate, persistentCard),
    );
    if (index < 0) {
      throw new GameRuleViolationError(
        'CARD_NOT_IN_HAND',
        { handId, playerId },
        'Carte absente de la main',
      );
    }
    const [taken] = hand.splice(index, 1);
    return definition
      ? this.fromPersistentCard<TCard>(definition.deck, taken)
      : (structuredClone(taken) as TCard);
  }

  discardFromHand<TCard>(
    handId: string,
    deckId: string,
    playerId: number,
    card: TCard,
  ): TCard {
    const discarded = this.take(handId, playerId, card);
    this.discard(deckId, discarded);
    return discarded;
  }

  exchange<TCard>(
    handId: string,
    leftPlayerId: number,
    leftCard: TCard,
    rightPlayerId: number,
    rightCard: TCard,
  ): void {
    const leftHand = this.hand<TCard>(handId, leftPlayerId);
    const rightHand = this.hand<TCard>(handId, rightPlayerId);
    if (!leftHand.some((card) => Object.is(card, leftCard))) {
      throw new GameRuleViolationError('CARD_NOT_IN_HAND', {
        handId,
        playerId: leftPlayerId,
      });
    }
    if (!rightHand.some((card) => Object.is(card, rightCard))) {
      throw new GameRuleViolationError('CARD_NOT_IN_HAND', {
        handId,
        playerId: rightPlayerId,
      });
    }
    const takenLeft = this.take(handId, leftPlayerId, leftCard);
    const takenRight = this.take(handId, rightPlayerId, rightCard);
    this.give(handId, leftPlayerId, takenRight);
    this.give(handId, rightPlayerId, takenLeft);
    this.emit('cards.exchanged', {
      handId,
      leftPlayerId,
      rightPlayerId,
    });
  }

  shuffleHands(handId: string, playerIds: readonly number[]): void {
    const sizes = playerIds.map(
      (playerId) => this.persistentHand(handId, playerId).length,
    );
    const shuffled = this.random.shuffle(
      playerIds.flatMap((playerId) => this.persistentHand(handId, playerId)),
    );
    let cursor = 0;
    for (const [index, playerId] of playerIds.entries()) {
      const size = sizes[index] ?? 0;
      this.state.hands[handId][String(playerId)] = shuffled.slice(
        cursor,
        cursor + size,
      );
      cursor += size;
    }
    this.emit('cards.hands-shuffled', { handId, playerIds: [...playerIds] });
  }

  transfer<TCard>(
    handId: string,
    fromPlayerId: number,
    toPlayerId: number,
    card: TCard,
  ): void {
    const transferred = this.take(handId, fromPlayerId, card);
    this.give(handId, toPlayerId, transferred);
    this.emit('card.transferred', {
      handId,
      fromPlayerId,
      toPlayerId,
    });
  }

  exchangeRandom<TCard>(
    handId: string,
    leftPlayerId: number,
    rightPlayerId: number,
  ): void {
    if (leftPlayerId === rightPlayerId) return;
    const leftCard = this.random.pick(this.hand<TCard>(handId, leftPlayerId));
    const rightCard = this.random.pick(this.hand<TCard>(handId, rightPlayerId));
    if (leftCard && rightCard) {
      this.exchange(handId, leftPlayerId, leftCard, rightPlayerId, rightCard);
      return;
    }
    if (leftCard) this.transfer(handId, leftPlayerId, rightPlayerId, leftCard);
    else if (rightCard)
      this.transfer(handId, rightPlayerId, leftPlayerId, rightCard);
  }

  stealRandom<TCard>(
    handId: string,
    fromPlayerId: number,
    toPlayerId: number,
  ): TCard | null {
    const card = this.random.shuffle(this.hand<TCard>(handId, fromPlayerId))[0];
    if (card == null) return null;
    this.transfer(handId, fromPlayerId, toPlayerId, card);
    return card;
  }

  swapHands(handId: string, leftPlayerId: number, rightPlayerId: number): void {
    const hands = (this.state.hands[handId] ??= {});
    const left = hands[String(leftPlayerId)] ?? [];
    const right = hands[String(rightPlayerId)] ?? [];
    hands[String(leftPlayerId)] = right;
    hands[String(rightPlayerId)] = left;
    this.emit('cards.hands-swapped', {
      handId,
      leftPlayerId,
      rightPlayerId,
    });
  }

  discardRandom<TCard>(
    handId: string,
    deckId: string,
    playerId: number,
  ): TCard | null {
    const card = this.random.shuffle(this.hand<TCard>(handId, playerId))[0];
    if (card == null) return null;
    this.play(handId, deckId, playerId, card);
    return card;
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

  setIds(collectionId: string): string[] {
    return Object.keys(this.requireSets(collectionId).sets);
  }

  missingFromSet(
    collectionId: string,
    setId: string,
    playerId: number,
  ): string[] {
    const definition = this.requireSets(collectionId);
    const required = definition.sets[setId];
    if (!required) {
      throw new GameNotFoundError(`Famille de cartes inconnue: ${setId}`);
    }
    const available = [...this.hand<string>(definition.hand, playerId)];
    return required.filter((cardId) => {
      const index = available.indexOf(cardId);
      if (index < 0) return true;
      available.splice(index, 1);
      return false;
    });
  }

  completableSets(collectionId: string, playerId: number): string[] {
    const completed = new Set(this.playerCompletedSets(collectionId, playerId));
    return this.setIds(collectionId).filter(
      (setId) =>
        !completed.has(setId) &&
        this.missingFromSet(collectionId, setId, playerId).length === 0,
    );
  }

  completeSet(
    collectionId: string,
    playerId: number,
    setId: string,
    options: {
      allowIncomplete?: boolean;
      consume?: boolean;
      discard?: boolean;
    } = {},
  ): boolean {
    const definition = this.requireSets(collectionId);
    const completed = this.playerCompletedSets(collectionId, playerId);
    if (completed.includes(setId)) return false;
    const required = definition.sets[setId];
    if (!required) {
      throw new GameNotFoundError(`Famille de cartes inconnue: ${setId}`);
    }
    const present = required.filter((cardId) =>
      this.hand<string>(definition.hand, playerId).includes(cardId),
    );
    if (!options.allowIncomplete && present.length !== required.length) {
      return false;
    }
    if (options.consume ?? true) {
      for (const cardId of present) {
        if (options.discard ?? true) {
          this.discardFromHand(
            definition.hand,
            definition.deck,
            playerId,
            cardId,
          );
        } else {
          this.take(definition.hand, playerId, cardId);
        }
      }
    }
    completed.push(setId);
    this.emit('cards.set-completed', { collectionId, playerId, setId });
    return true;
  }

  playerCompletedSets(collectionId: string, playerId: number): string[] {
    const byPlayer = (this.state.completedSets[collectionId] ??= {});
    return (byPlayer[String(playerId)] ??= []);
  }

  completedSetCounts(collectionId: string): Record<number, number> {
    const byPlayer = this.state.completedSets[collectionId] ?? {};
    return Object.fromEntries(
      Object.entries(byPlayer).map(([playerId, setIds]) => [
        Number(playerId),
        setIds.length,
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
        if (this.drawToHand(deckId, handId, playerId) == null) return;
      }
    }
  }

  private drawOne<TCard>(deckId: string): TCard | null {
    const deck = this.state.decks[deckId] ?? [];
    const persistentCard = deck.shift();
    if (persistentCard == null) return null;
    this.lifecycle(deckId).exhausted = false;
    this.emit('card.drawn', { deckId });
    return this.fromPersistentCard<TCard>(deckId, persistentCard);
  }

  private markExhausted(deckId: string): void {
    const lifecycle = this.lifecycle(deckId);
    if (lifecycle.exhausted) return;
    lifecycle.exhausted = true;
    this.emit('deck.exhausted', { deckId });
  }

  private lifecycle(deckId: string): DeckLifecycleState {
    return (this.state.deckLifecycles[deckId] ??= {
      empty: 'exhaust',
      exhausted: false,
    });
  }

  private requireSets(collectionId: string): CardSetsDefinition {
    const definition = this.setDefinitions.get(collectionId);
    if (!definition) {
      throw new GameNotFoundError(
        `Collection de cartes inconnue: ${collectionId}`,
      );
    }
    return definition;
  }

  private persistentHand(handId: string, playerId: number): unknown[] {
    const hands = (this.state.hands[handId] ??= {});
    return (hands[String(playerId)] ??= []);
  }

  private registerCatalog<TCard>(definition: DeckDefinition<TCard>): void {
    const identifiedCards = definition.cards.filter(isIdentifiedCard);
    if (
      definition.cards.length === 0 ||
      identifiedCards.length !== definition.cards.length
    ) {
      this.catalogs.delete(definition.id);
      return;
    }
    const cardsById = new Map<string, unknown>();
    for (const card of identifiedCards) {
      const key = contentIdKey(card.id);
      if (cardsById.has(key)) {
        throw new GameConfigurationError(
          `Identifiant de carte dupliqué dans ${definition.id}: ${String(card.id)}`,
        );
      }
      cardsById.set(key, card);
    }
    this.catalogs.set(definition.id, { cardsById });
  }

  private registerDefinition(
    definition: DeckDefinition<unknown> | HandsDefinition | CardSetsDefinition,
  ): void {
    if (definition.component === 'cards.deck') {
      this.registerCatalog(definition);
    } else if (definition.component === 'cards.hands') {
      this.handDefinitions.set(definition.id, definition);
    } else {
      this.setDefinitions.set(definition.id, definition);
    }
  }

  private toPersistentCard<TCard>(deckId: string, card: TCard): unknown {
    const catalog = this.catalogs.get(deckId);
    if (!catalog || !isIdentifiedCard(card)) return structuredClone(card);
    const key = contentIdKey(card.id);
    if (!catalog.cardsById.has(key)) {
      throw new GameRuleViolationError(
        'UNKNOWN_CARD_CONTENT',
        { deckId, cardId: card.id },
        'Carte absente du catalogue statique',
      );
    }
    return card.id;
  }

  private fromPersistentCard<TCard>(deckId: string, card: unknown): TCard {
    const content =
      typeof card === 'string' || typeof card === 'number'
        ? this.catalogs.get(deckId)?.cardsById.get(contentIdKey(card))
        : undefined;
    return structuredClone((content ?? card) as TCard);
  }
}

export function createCardsKitState(): CardsKitState {
  return {
    decks: {},
    discards: {},
    deckLifecycles: {},
    hands: {},
    completedSets: {},
  };
}

export function projectCardsKitState(
  state: CardsKitState,
  viewerPlayerId: number | null,
  definitions: readonly (HandsDefinition | CardSetsDefinition)[] = [],
): CardsPlayerView {
  const handDefinitions = new Map(
    definitions
      .filter(
        (definition): definition is HandsDefinition =>
          definition.component === 'cards.hands',
      )
      .map((definition) => [definition.id, definition]),
  );
  const setDefinitions = new Map(
    definitions
      .filter(
        (definition): definition is CardSetsDefinition =>
          definition.component === 'cards.sets',
      )
      .map((definition) => [definition.id, definition]),
  );
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
        const definition = handDefinitions.get(id);
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
    collections: Object.fromEntries(
      Object.entries(state.completedSets).map(([id, byPlayer]) => {
        const visibility = setDefinitions.get(id)?.visibility ?? 'public';
        return [
          id,
          {
            visibility,
            byPlayer: Object.fromEntries(
              Object.entries(byPlayer).map(([playerId, setIds]) => [
                playerId,
                visibility === 'public' || Number(playerId) === viewerPlayerId
                  ? [...setIds]
                  : { count: setIds.length },
              ]),
            ),
          },
        ];
      }),
    ),
  };
}

function isIdentifiedCard<TValue>(
  value: TValue,
): value is TValue & { readonly id: CardContentId } {
  if (value == null || typeof value !== 'object' || !('id' in value)) {
    return false;
  }
  const id = value.id;
  return typeof id === 'string' || typeof id === 'number';
}

function contentIdKey(id: CardContentId): string {
  return `${typeof id}:${String(id)}`;
}

function deepFreeze<TValue>(value: TValue): TValue {
  if (value == null || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}
