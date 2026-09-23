import {
  atAuthoringPath,
  withAuthoringPath,
} from '../contracts/authoring-origin';
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
    const known = atAuthoringPath(
      'deck',
      () => new Set((deck?.catalog ?? deck?.cards ?? []).map(key)),
    );
    const seen = new Set<string>();
    for (const [index, id] of ids.entries()) {
      if (seen.has(id) || !known.has(id))
        throw withAuthoringPath(
          new GameConfigurationError(
            `Invalid deferred cards for hand ${hand.id}`,
          ),
          `initialDeferredCardIds[${index}]`,
        );
      seen.add(id);
    }
  }
  if (!hand.acceptedDecks) return;
  const primary = decks.get(hand.deck);
  if (
    !primary ||
    !Array.isArray(hand.acceptedDecks) ||
    hand.acceptedDecks.length > 512
  )
    throw withAuthoringPath(
      new GameConfigurationError(`Invalid accepted decks for hand ${hand.id}`),
      !primary ? 'deck' : 'acceptedDecks',
    );
  const catalog = atAuthoringPath(
    'deck',
    () =>
      new Map(
        (primary.catalog ?? primary.cards).map((card) => [key(card), card]),
      ),
  );
  const seen = new Set<string>();
  const accepted: readonly string[] = hand.acceptedDecks;
  for (const [index, id] of accepted.entries()) {
    const path = `acceptedDecks[${index}]`;
    if (seen.has(id))
      throw withAuthoringPath(
        new GameConfigurationError(
          `Invalid accepted decks for hand ${hand.id}`,
        ),
        path,
      );
    seen.add(id);
    const source = decks.get(id);
    if (
      !source ||
      atAuthoringPath(path, () =>
        (source.catalog ?? source.cards).some(
          (card) => !sameSerializableValue(catalog.get(key(card)), card),
        ),
      )
    )
      throw withAuthoringPath(
        new GameConfigurationError(
          `Incompatible deck ${id} for hand ${hand.id}`,
        ),
        path,
      );
  }
}

function key(card: CardValue): string {
  if (isIdentifiedCard(card)) return contentIdKey(card.id);
  if (typeof card === 'string' || typeof card === 'number')
    return contentIdKey(card);
  throw new GameConfigurationError('A shared hand requires identified cards');
}
