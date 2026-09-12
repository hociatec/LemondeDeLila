import type {
  CardValue,
  DeckDefinition,
  HandsDefinition,
} from './cards-contracts';
import { contentIdKey, isIdentifiedCard } from './cards-contracts';
import { sameSerializableValue } from '../state/serializable-value';
import { GameConfigurationError } from '../../../core/domain/errors/game-domain.errors';

/** A shared hand keeps one canonical representation for every accepted card. */
export function assertHandDeckDefinitions(
  hand: HandsDefinition,
  decks: ReadonlyMap<string, DeckDefinition<CardValue>>,
): void {
  if (hand.initialDeferredCardIds) {
    const deck = decks.get(hand.deck);
    const ids = hand.initialDeferredCardIds.map(contentIdKey);
    const known = new Set((deck?.catalog ?? deck?.cards ?? []).map(key));
    if (new Set(ids).size !== ids.length || ids.some((id) => !known.has(id))) {
      throw new GameConfigurationError(
        `Invalid deferred cards for hand ${hand.id}`,
      );
    }
  }
  if (!hand.acceptedDecks) return;
  const primary = decks.get(hand.deck);
  if (
    !primary ||
    !Array.isArray(hand.acceptedDecks) ||
    hand.acceptedDecks.length > 512 ||
    new Set(hand.acceptedDecks).size !== hand.acceptedDecks.length
  )
    throw new GameConfigurationError(
      `Invalid accepted decks for hand ${hand.id}`,
    );
  const catalog = new Map(
    (primary.catalog ?? primary.cards).map((card) => [key(card), card]),
  );
  const accepted: readonly string[] = hand.acceptedDecks;
  for (const id of accepted) {
    const source = decks.get(id);
    if (
      !source ||
      (source.catalog ?? source.cards).some(
        (card) => !sameSerializableValue(catalog.get(key(card)), card),
      )
    )
      throw new GameConfigurationError(
        `Incompatible deck ${id} for hand ${hand.id}`,
      );
  }
}

function key(card: CardValue): string {
  if (isIdentifiedCard(card)) return contentIdKey(card.id);
  if (typeof card === 'string' || typeof card === 'number')
    return contentIdKey(card);
  throw new GameConfigurationError('A shared hand requires identified cards');
}
