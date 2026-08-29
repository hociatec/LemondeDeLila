import {
  GameConfigurationError,
  GameNotFoundError,
  GameRuleViolationError,
  GameStateViolationError,
} from '../../../domain/errors/game-domain.errors';
import type { GameRng } from '../../models/game-execution-context.model';
import type { EventVisibility } from '../../models/game-event.model';
import {
  contentIdKey,
  isIdentifiedCard,
  type CardCatalog,
  type CardSetsDefinition,
  type CardValue,
  type CardsKitState,
  type DeckDefinition,
  type DeckLifecycleState,
  type HandsDefinition,
} from './cards-contracts';

export abstract class GameCardsStateController {
  abstract give<TCard>(handId: string, playerId: number, card: TCard): void;
  abstract deal(
    deckId: string,
    handId: string,
    playerIds: readonly number[],
    count: number,
  ): void;

  constructor(
    protected readonly state: CardsKitState,
    protected readonly random: Pick<GameRng, 'pick' | 'shuffle'>,
    protected readonly emit: (
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

  protected readonly catalogs = new Map<string, CardCatalog>();
  protected readonly handDefinitions = new Map<string, HandsDefinition>();
  protected readonly setDefinitions = new Map<string, CardSetsDefinition>();

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

  protected lifecycle(deckId: string): DeckLifecycleState {
    return (this.state.deckLifecycles[deckId] ??= {
      empty: 'exhaust',
      exhausted: false,
    });
  }

  protected requireSets(collectionId: string): CardSetsDefinition {
    const definition = this.setDefinitions.get(collectionId);
    if (!definition) {
      throw new GameNotFoundError(
        `Collection de cartes inconnue: ${collectionId}`,
      );
    }
    return definition;
  }

  protected persistentHand(handId: string, playerId: number): CardValue[] {
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
    const cardsById = new Map<string, CardValue>();
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

  protected toPersistentCard<TCard>(deckId: string, card: TCard): CardValue {
    const catalog = this.catalogs.get(deckId);
    if (!catalog || !isIdentifiedCard(card)) {
      return structuredClone(card) as CardValue;
    }
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

  protected fromPersistentCard<TCard>(deckId: string, card: CardValue): TCard {
    const content =
      typeof card === 'string' || typeof card === 'number'
        ? this.catalogs.get(deckId)?.cardsById.get(contentIdKey(card))
        : undefined;
    return structuredClone((content ?? card) as TCard);
  }
}
