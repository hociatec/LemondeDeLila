import { GameConfigurationError } from '../../../core/domain/errors/game-domain.errors';
import { cardContent } from '../content/game-content';

export type CardId = string | number;
export type CardValue = CardId | object;
export type CardDefinition<
  TCard extends CardId | { id: CardId } = { id: CardId },
> = Readonly<TCard>;

/**
 * Runtime card representation. Stateless games keep their lightweight card
 * value; games with mutable per-copy state opt into an explicit instance.
 */
export type CardInstance<
  TDefinition extends CardValue,
  TInstanceState extends object | undefined = undefined,
> = TInstanceState extends object
  ? Readonly<{
      instanceId: string;
      definition: CardDefinition<Extract<TDefinition, CardId | { id: CardId }>>;
      state: TInstanceState;
    }>
  : TDefinition;

export type CardZone<
  TDefinition extends CardValue,
  TInstanceState extends object | undefined = undefined,
> = ReadonlyArray<CardInstance<TDefinition, TInstanceState>>;

export type DeckDefinition<TCard extends CardValue> = {
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

export type HandsDefinition<TDeckId extends string = string> = {
  readonly component: 'cards.hands';
  id: string;
  deck: TDeckId;
  initial: number;
  visibility: 'owner' | 'public';
};

export type CardZoneDefinition<TDeckId extends string = string> = {
  readonly component: 'cards.zone';
  id: string;
  deck: TDeckId;
  visibility: 'public' | 'hidden';
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
  decks: Record<string, CardValue[]>;
  discards: Record<string, CardValue[]>;
  deckLifecycles: Record<string, DeckLifecycleState>;
  hands: Record<string, Record<string, CardValue[]>>;
  zones: Record<string, CardValue[]>;
  completedSets: Record<string, Record<string, string[]>>;
};

export type CardsPlayerView = {
  decks: Record<string, { count: number }>;
  discards: Record<string, { count: number; cards: CardValue[] }>;
  hands: Record<
    string,
    {
      visibility: HandsDefinition['visibility'];
      byPlayer: Record<string, CardValue[] | { count: number }>;
    }
  >;
  zones: Record<
    string,
    {
      visibility: CardZoneDefinition['visibility'];
      cards: CardValue[] | { count: number };
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

export type CardContentId = CardId;

export type CardCatalog = {
  readonly cardsById: ReadonlyMap<string, CardValue>;
};

export const cards = {
  deck<TCard extends CardValue>(
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
    const catalog =
      identifiedCards.length === definition.cards.length
        ? cardContent(identifiedCards)
        : deepFreeze(structuredClone(definition.cards));
    return deepFreeze({
      ...definition,
      component: 'cards.deck',
      cards: catalog,
    });
  },

  hands<const TDeckId extends string>(
    definition: Omit<HandsDefinition<TDeckId>, 'component'>,
  ): HandsDefinition<TDeckId> {
    return Object.freeze({ ...definition, component: 'cards.hands' });
  },

  zone<const TDeckId extends string>(
    definition: Omit<CardZoneDefinition<TDeckId>, 'component'>,
  ): CardZoneDefinition<TDeckId> {
    return Object.freeze({ ...definition, component: 'cards.zone' });
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

export function isIdentifiedCard<TValue>(
  value: TValue,
): value is TValue & { readonly id: CardContentId } {
  if (value == null || typeof value !== 'object' || !('id' in value)) {
    return false;
  }
  const id = value.id;
  return typeof id === 'string' || typeof id === 'number';
}

export function contentIdKey(id: CardContentId): string {
  return `${typeof id}:${String(id)}`;
}

function deepFreeze<TValue>(value: TValue): TValue {
  if (value == null || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}
