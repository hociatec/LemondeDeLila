import type { DeckPoliciesService } from '../../../../../application/features/deck-policies/services/deck-policies.service';

import { BANDE_A_BANANE_CARD_BY_ID } from '../../model/la-bande-a-banane-cards';
import type { BandeABananeMetadata } from '../../model/la-bande-a-banane-state.model';

export function drawOneBandeABananeCard(
  deckPolicies: DeckPoliciesService,
  meta: BandeABananeMetadata,
): { meta: BandeABananeMetadata; cardId: string | null } {
  const draw = deckPolicies.drawOne<string, BandeABananeMetadata>({
    meta,
    deckKey: 'deck',
    discardKey: 'discard',
    rngKey: 'rng',
  });
  return { meta: draw.meta, cardId: draw.card };
}

export function getBandeABananePlayerHand(
  meta: BandeABananeMetadata,
  playerId: number,
): string[] {
  return Array.isArray(meta.hands?.[playerId]) ? meta.hands[playerId] : [];
}

export function addBandeABananeCardToHand(
  meta: BandeABananeMetadata,
  playerId: number,
  cardId: string,
): BandeABananeMetadata {
  const hands = { ...(meta.hands ?? {}) };
  const playerHand = [...(hands[playerId] ?? []), cardId];
  hands[playerId] = playerHand;
  return { ...meta, hands };
}

export function removeBandeABananeCardFromHand(
  meta: BandeABananeMetadata,
  playerId: number,
  cardId: string,
): BandeABananeMetadata {
  const hands = { ...(meta.hands ?? {}) };
  const playerHand = [...(hands[playerId] ?? [])];
  const index = playerHand.indexOf(cardId);
  if (index >= 0) playerHand.splice(index, 1);
  hands[playerId] = playerHand;
  return { ...meta, hands };
}

export function addBandeABananeCardToDiscard(
  meta: BandeABananeMetadata,
  cardId: string,
): BandeABananeMetadata {
  const discard = [...(meta.discard ?? []), cardId];
  return { ...meta, discard };
}

export function getBandeABananeCardName(cardId: string): string {
  return BANDE_A_BANANE_CARD_BY_ID[cardId]?.name ?? 'une carte';
}
