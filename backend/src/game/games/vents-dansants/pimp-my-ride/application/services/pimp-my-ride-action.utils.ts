import type { DeckPoliciesService } from '../../../../../application/features/deck-policies/services/deck-policies.service';
import type { PimpMyRideMetadata } from '../../model/pimp-my-ride-state.model';

export function drawOnePimpMyRideCard(
  deckPolicies: DeckPoliciesService,
  meta: PimpMyRideMetadata,
): { cardId: string | null; meta: PimpMyRideMetadata } {
  const draw = deckPolicies.drawOne<string, PimpMyRideMetadata>({
    meta,
    deckKey: 'deck',
    discardKey: 'discard',
    rngKey: 'rng',
  });
  return { cardId: draw.card, meta: draw.meta };
}

export function addPimpMyRideCardToHandMeta(
  meta: PimpMyRideMetadata,
  playerId: number,
  cardId: string,
): PimpMyRideMetadata {
  const hands = { ...(meta.hands ?? {}) };
  const playerHand = [...(hands[playerId] ?? []), cardId];
  hands[playerId] = playerHand;
  return { ...meta, hands };
}

export function removePimpMyRideCardFromHandMeta(
  meta: PimpMyRideMetadata,
  playerId: number,
  cardId: string,
): PimpMyRideMetadata {
  const hands = { ...(meta.hands ?? {}) };
  const playerHand = Array.isArray(hands[playerId]) ? [...hands[playerId]] : [];
  const index = playerHand.indexOf(cardId);
  if (index >= 0) playerHand.splice(index, 1);
  hands[playerId] = playerHand;
  return { ...meta, hands };
}

export function addPimpMyRideCardToDiscardMeta(
  meta: PimpMyRideMetadata,
  cardId: string,
): PimpMyRideMetadata {
  const discard = [...(meta.discard ?? []), cardId];
  return { ...meta, discard };
}
