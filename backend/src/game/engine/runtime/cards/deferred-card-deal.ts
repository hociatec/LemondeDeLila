import {
  contentIdKey,
  isIdentifiedCard,
  type CardId,
  type CardValue,
} from './cards-contracts';

type DealingCards = {
  deckCount(deckId: string): number;
  draw(deckId: string): CardValue | null;
  give(handId: string, playerId: number, card: CardValue): void;
  putOnTop(deckId: string, cards: readonly CardValue[]): void;
};

/** Bounded by the original draw pile: deferred cards cannot be drawn twice. */
export function dealDeferredCards(
  cards: DealingCards,
  deckId: string,
  handId: string,
  playerIds: readonly number[],
  count: number,
  deferredCardIds: readonly CardId[],
): void {
  const excluded = new Set(deferredCardIds.map(contentIdKey));
  const buffer: CardValue[] = [];
  for (
    let round = 0;
    round < count && cards.deckCount(deckId) > 0;
    round += 1
  ) {
    for (const playerId of playerIds) {
      while (cards.deckCount(deckId) > 0) {
        const card = cards.draw(deckId);
        if (card == null) break;
        const id = isIdentifiedCard(card) ? card.id : card;
        if (
          (typeof id === 'string' || typeof id === 'number') &&
          excluded.has(contentIdKey(id))
        ) {
          buffer.push(card);
          continue;
        }
        cards.give(handId, playerId, card);
        break;
      }
    }
  }
  cards.putOnTop(deckId, buffer);
}
