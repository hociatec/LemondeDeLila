import type { GameCardsController } from './cards-hands-controller';
import type {
  CardValue,
  CardZoneDefinition,
  DeckDefinition,
  HandsDefinition,
} from './cards-contracts';

export type CardDeckMap = Readonly<Record<string, DeckDefinition<CardValue>>>;
export type CardOfDeck<TDecks, TDeckId extends keyof TDecks> =
  TDecks[TDeckId] extends DeckDefinition<infer TCard> ? TCard : never;

export type TypedHandDefinition<
  TDecks extends CardDeckMap,
  TDeckId extends keyof TDecks & string,
> = Omit<HandsDefinition, 'deck'> & { readonly deck: TDeckId };

export type CardHandMap<TDecks extends CardDeckMap> = Readonly<
  Record<string, TypedHandDefinition<TDecks, keyof TDecks & string>>
>;

export type TypedCardZoneDefinition<
  TDecks extends CardDeckMap,
  TDeckId extends keyof TDecks & string,
> = Omit<CardZoneDefinition, 'component' | 'id' | 'deck'> & {
  readonly deck: TDeckId;
};

export type CardZoneMap<TDecks extends CardDeckMap> = Readonly<
  Record<string, TypedCardZoneDefinition<TDecks, keyof TDecks & string>>
>;

type HandIdForDeck<THands, TDeckId extends PropertyKey> = {
  [THandId in keyof THands]: THands[THandId] extends { readonly deck: TDeckId }
    ? THandId
    : never;
}[keyof THands] &
  string;

export type TypedCardsKitState<
  TDecks extends CardDeckMap,
  THands extends CardHandMap<TDecks>,
  TZones extends CardZoneMap<TDecks> = Record<string, never>,
> = {
  decks: { [TDeckId in keyof TDecks]?: CardOfDeck<TDecks, TDeckId>[] };
  discards: { [TDeckId in keyof TDecks]?: CardOfDeck<TDecks, TDeckId>[] };
  hands: {
    [THandId in keyof THands]?: Record<
      string,
      CardOfDeck<TDecks, THands[THandId]['deck']>[]
    >;
  };
  /** Game-declared zones such as market, table, removed or active. */
  zones: {
    [TZoneId in keyof TZones]?: CardOfDeck<TDecks, TZones[TZoneId]['deck']>[];
  };
};

export type TypedCardsRuntime<
  TDecks extends CardDeckMap,
  THands extends CardHandMap<TDecks>,
  TZones extends CardZoneMap<TDecks> = Record<string, never>,
> = {
  draw<TDeckId extends keyof TDecks & string>(
    deckId: TDeckId,
  ): CardOfDeck<TDecks, TDeckId> | null;
  drawOrRecycle<TDeckId extends keyof TDecks & string>(
    deckId: TDeckId,
  ): CardOfDeck<TDecks, TDeckId> | null;
  discardPile<TDeckId extends keyof TDecks & string>(
    deckId: TDeckId,
  ): CardOfDeck<TDecks, TDeckId>[];
  discard<TDeckId extends keyof TDecks & string>(
    deckId: TDeckId,
    card: CardOfDeck<TDecks, TDeckId>,
  ): void;
  drawToHand<
    TDeckId extends keyof TDecks & string,
    THandId extends HandIdForDeck<THands, TDeckId>,
  >(
    deckId: TDeckId,
    handId: THandId,
    playerId: number,
    options?: { recycle?: boolean },
  ): CardOfDeck<TDecks, TDeckId> | null;
  drawManyToHand<
    TDeckId extends keyof TDecks & string,
    THandId extends HandIdForDeck<THands, TDeckId>,
  >(
    deckId: TDeckId,
    handId: THandId,
    playerId: number,
    count: number,
    options?: { recycle?: boolean },
  ): CardOfDeck<TDecks, TDeckId>[];
  hand<THandId extends keyof THands & string>(
    handId: THandId,
    playerId: number,
  ): CardOfDeck<TDecks, THands[THandId]['deck']>[];
  give<THandId extends keyof THands & string>(
    handId: THandId,
    playerId: number,
    card: CardOfDeck<TDecks, THands[THandId]['deck']>,
  ): void;
  take<THandId extends keyof THands & string>(
    handId: THandId,
    playerId: number,
    card: CardOfDeck<TDecks, THands[THandId]['deck']>,
  ): CardOfDeck<TDecks, THands[THandId]['deck']>;
  play<
    TDeckId extends keyof TDecks & string,
    THandId extends HandIdForDeck<THands, TDeckId>,
  >(
    handId: THandId,
    deckId: TDeckId,
    playerId: number,
    card: CardOfDeck<TDecks, TDeckId>,
  ): void;
  zone<TZoneId extends keyof TZones & string>(
    zoneId: TZoneId,
  ): CardOfDeck<TDecks, TZones[TZoneId]['deck']>[];
  putInZone<TZoneId extends keyof TZones & string>(
    zoneId: TZoneId,
    card: CardOfDeck<TDecks, TZones[TZoneId]['deck']>,
  ): void;
  takeFromZone<TZoneId extends keyof TZones & string>(
    zoneId: TZoneId,
    card: CardOfDeck<TDecks, TZones[TZoneId]['deck']>,
  ): CardOfDeck<TDecks, TZones[TZoneId]['deck']>;
};

export type CardsSchemaDefinition<
  TDecks extends CardDeckMap = CardDeckMap,
  THands extends CardHandMap<TDecks> = CardHandMap<TDecks>,
  TZones extends CardZoneMap<TDecks> = CardZoneMap<TDecks>,
> = Readonly<{
  decks: TDecks;
  hands: THands;
  zones: TZones;
  components: readonly (
    DeckDefinition<CardValue> | HandsDefinition | CardZoneDefinition
  )[];
  bind(
    controller: GameCardsController,
  ): TypedCardsRuntime<TDecks, THands, TZones>;
}>;

export function defineCardsSchema<
  const TDecks extends CardDeckMap,
  const THands extends CardHandMap<TDecks>,
  const TZones extends CardZoneMap<TDecks> = Record<string, never>,
>(definition: {
  decks: TDecks;
  hands: THands;
  zones?: TZones;
}): CardsSchemaDefinition<TDecks, THands, TZones> {
  return Object.freeze({
    ...definition,
    zones: Object.freeze(definition.zones ?? {}) as TZones,
    components: Object.freeze([
      ...Object.values(definition.decks),
      ...Object.values(definition.hands),
      ...Object.entries(definition.zones ?? {}).map(([id, zone]) =>
        Object.freeze({
          ...zone,
          component: 'cards.zone' as const,
          id,
          visibility: zone.visibility ?? 'public',
        }),
      ),
    ]),
    bind(
      controller: GameCardsController,
    ): TypedCardsRuntime<TDecks, THands, TZones> {
      return controller;
    },
  });
}
