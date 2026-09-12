import type { HandsDefinition } from './cards-contracts';
import { assertGamePlayerId } from '../kits/numeric-invariants';
import { GameRuleViolationError } from '../../../core/domain/errors/game-domain.errors';

/** Validate every destination before removing a card from its current container. */
export function assertCardHandDestination(
  definitions: ReadonlyMap<string, HandsDefinition>,
  handId: string,
  deckId: string,
  playerId: number,
): void {
  assertGamePlayerId(playerId);
  const hand = definitions.get(handId);
  if (!hand || (hand.deck !== deckId && !hand.acceptedDecks?.includes(deckId)))
    throw new GameRuleViolationError('CARD_HAND_DECK_MISMATCH', {
      handId,
      deckId,
    });
}

export function assertCardRecipients(playerIds: readonly number[]): void {
  for (const playerId of playerIds) assertGamePlayerId(playerId);
  if (new Set(playerIds).size !== playerIds.length)
    throw new GameRuleViolationError('CARD_PARTICIPANTS_INVALID');
}
