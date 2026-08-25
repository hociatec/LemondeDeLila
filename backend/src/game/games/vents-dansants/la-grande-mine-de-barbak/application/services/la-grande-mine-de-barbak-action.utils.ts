import type { DeckPoliciesService } from '../../../../../deck-policies/application/services/deck-policies.service';
import { LA_GRANDE_MINE_CARD_BY_ID } from '../../model/la-grande-mine-cards';
import type { LaGrandeMineMetadata } from '../../model/la-grande-mine-state.model';

export function drawOneLaGrandeMineCard(
  deckPolicies: DeckPoliciesService,
  meta: LaGrandeMineMetadata,
): { cardId: string | null; meta: LaGrandeMineMetadata } {
  const draw = deckPolicies.drawOne<string, LaGrandeMineMetadata>({
    meta,
    deckKey: 'deck',
    discardKey: 'discard',
    rngKey: 'rng',
  });
  return { cardId: draw.card, meta: draw.meta };
}

export function addLaGrandeMineCardToHandMeta(
  meta: LaGrandeMineMetadata,
  playerId: number,
  cardId: string,
): LaGrandeMineMetadata {
  const hand = Array.isArray(meta.hands?.[playerId]) ? [...meta.hands[playerId]] : [];
  hand.push(cardId);
  return {
    ...meta,
    hands: { ...(meta.hands ?? {}), [playerId]: hand },
  };
}

export function removeLaGrandeMineCardFromHandMeta(
  meta: LaGrandeMineMetadata,
  playerId: number,
  cardId: string,
): LaGrandeMineMetadata {
  const hands = { ...(meta.hands ?? {}) };
  const hand = Array.isArray(hands[playerId]) ? [...hands[playerId]] : [];
  const index = hand.indexOf(cardId);
  if (index >= 0) hand.splice(index, 1);
  hands[playerId] = hand;
  return { ...meta, hands };
}

export function addLaGrandeMineCardToDiscardMeta(
  meta: LaGrandeMineMetadata,
  cardId: string,
): LaGrandeMineMetadata {
  const discard = [...(meta.discard ?? []), cardId];
  return { ...meta, discard };
}

export function scoreLaGrandeMineDomain(domain?: {
  treasures?: string[];
  objects?: string[];
}): number {
  if (!domain) return 0;
  let total = 0;
  for (const cardId of [...(domain.treasures ?? []), ...(domain.objects ?? [])]) {
    total += LA_GRANDE_MINE_CARD_BY_ID[cardId]?.points ?? 0;
  }
  return total;
}
