import type { DeckPoliciesService } from '../../../../../application/features/deck-policies/services/deck-policies.service';

import type { EntreRitesMetadata } from '../../model/entre-rites-state.model';

export function recordEntreRitesSpecial(
  meta: EntreRitesMetadata,
  playerId: number,
  cardId: string,
): EntreRitesMetadata {
  const specials = { ...(meta.specialsPlayed ?? {}) };
  const count = { ...(meta.specialsPlayedCount ?? {}) };
  specials[playerId] = [...(specials[playerId] ?? []), cardId];
  count[playerId] = (count[playerId] ?? 0) + 1;
  return {
    ...meta,
    specialsPlayed: specials,
    specialsPlayedCount: count,
  };
}

export function drawEntreRitesOneCard(
  deckPolicies: DeckPoliciesService,
  meta: EntreRitesMetadata,
): {
  cardId: string | null;
  meta: EntreRitesMetadata;
} {
  const draw = deckPolicies.drawOne<string, EntreRitesMetadata>({
    meta,
    deckKey: 'deck',
    discardKey: 'discard',
    rngKey: 'rng',
  });
  return { cardId: draw.card, meta: draw.meta };
}

export function addEntreRitesCardToHand(
  meta: EntreRitesMetadata,
  playerId: number,
  cardId: string,
): EntreRitesMetadata {
  const hands = { ...(meta.hands ?? {}) };
  const hand = [...(hands[playerId] ?? []), cardId];
  hands[playerId] = hand;
  return { ...meta, hands };
}

export function removeEntreRitesCardFromHand(
  meta: EntreRitesMetadata,
  playerId: number,
  cardId: string,
): EntreRitesMetadata {
  const hands = { ...(meta.hands ?? {}) };
  const hand = Array.isArray(hands[playerId]) ? [...hands[playerId]] : [];
  const index = hand.indexOf(cardId);
  if (index >= 0) {
    hand.splice(index, 1);
  }
  hands[playerId] = hand;
  return { ...meta, hands };
}

export function addEntreRitesCardToDiscard(
  meta: EntreRitesMetadata,
  cardId: string,
): EntreRitesMetadata {
  const discard = [...(meta.discard ?? []), cardId];
  return { ...meta, discard };
}
