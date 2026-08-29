import type { GameCardsController } from './cards-hands-controller';
import type {
  CardValue,
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

export type TypedCardsKitState<
  TDecks extends CardDeckMap,
  THands extends CardHandMap<TDecks>,
> = {
  decks: { [TDeckId in keyof TDecks]?: CardOfDeck<TDecks, TDeckId>[] };
  discards: { [TDeckId in keyof TDecks]?: CardOfDeck<TDecks, TDeckId>[] };
  hands: {
    [THandId in keyof THands]?: Record<
      string,
      CardOfDeck<TDecks, THands[THandId]['deck']>[]
    >;
  };
};

export type TypedCardsRuntime<
  TDecks extends CardDeckMap,
  THands extends CardHandMap<TDecks>,
> = {
  draw<TDeckId extends keyof TDecks & string>(
    deckId: TDeckId,
  ): CardOfDeck<TDecks, TDeckId> | null;
  hand<THandId extends keyof THands & string>(
    handId: THandId,
    playerId: number,
  ): CardOfDeck<TDecks, THands[THandId]['deck']>[];
  give<THandId extends keyof THands & string>(
    handId: THandId,
    playerId: number,
    card: CardOfDeck<TDecks, THands[THandId]['deck']>,
  ): void;
};

export function defineCardsSchema<
  const TDecks extends CardDeckMap,
  const THands extends CardHandMap<TDecks>,
>(definition: { decks: TDecks; hands: THands }) {
  return Object.freeze({
    ...definition,
    components: Object.freeze([
      ...Object.values(definition.decks),
      ...Object.values(definition.hands),
    ]),
    bind(controller: GameCardsController): TypedCardsRuntime<TDecks, THands> {
      return controller;
    },
  });
}
