import type { DeckPoliciesService } from '../../../../../deck-policies/application/services/deck-policies.service';

import type { CerclesSacresMetadata } from '../../model/cercles-sacres-state.model';

export function drawOneCerclesSacresCard(
  deckPolicies: DeckPoliciesService,
  meta: CerclesSacresMetadata,
): { cardId: string | null; meta: CerclesSacresMetadata } {
  const draw = deckPolicies.drawOne<string, CerclesSacresMetadata>({
    meta,
    deckKey: 'deck',
    discardKey: 'discard',
    rngKey: 'rng',
  });
  return { cardId: draw.card, meta: draw.meta };
}

export function addCerclesSacresCardToHand(
  meta: CerclesSacresMetadata,
  playerId: number,
  cardId: string,
): CerclesSacresMetadata {
  const hands = { ...(meta.hands ?? {}) };
  const playerHand = [...(hands[playerId] ?? []), cardId];
  hands[playerId] = playerHand;
  return { ...meta, hands };
}

export function removeCerclesSacresCardsFromHand(
  meta: CerclesSacresMetadata,
  playerId: number,
  cardIds: string[],
): CerclesSacresMetadata {
  const hands = { ...(meta.hands ?? {}) };
  const playerHand = Array.isArray(hands[playerId]) ? [...hands[playerId]] : [];
  for (const cardId of cardIds) {
    const index = playerHand.indexOf(cardId);
    if (index >= 0) playerHand.splice(index, 1);
  }
  hands[playerId] = playerHand;
  return { ...meta, hands };
}

export function removeCerclesSacresCardFromHand(
  meta: CerclesSacresMetadata,
  playerId: number,
  cardId: string,
): CerclesSacresMetadata {
  return removeCerclesSacresCardsFromHand(meta, playerId, [cardId]);
}

export function addCerclesSacresCardToDiscard(
  meta: CerclesSacresMetadata,
  cardId: string,
): CerclesSacresMetadata {
  const discard = [...(meta.discard ?? []), cardId];
  return { ...meta, discard };
}
