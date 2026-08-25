import type { DeckPoliciesService } from '../../../../../deck-policies/application/services/deck-policies.service';

import {
  DAME_NATURE_CARD_BY_ID,
} from '../../model/dame-nature-cards';
import type { DameNatureMetadata } from '../../model/dame-nature-state.model';

export function drawOneDameNatureCard(
  deckPolicies: DeckPoliciesService,
  meta: DameNatureMetadata,
): { cardId: string | null; meta: DameNatureMetadata } {
  const draw = deckPolicies.drawOne<string, DameNatureMetadata>({
    meta,
    deckKey: 'deck',
    discardKey: 'discard',
    rngKey: 'rng',
  });
  return { cardId: draw.card, meta: draw.meta };
}

export function addDameNatureCardToHandMeta(
  meta: DameNatureMetadata,
  playerId: number,
  cardId: string,
): DameNatureMetadata {
  const hands = { ...(meta.hands ?? {}) };
  const playerHand = [...(hands[playerId] ?? []), cardId];
  hands[playerId] = playerHand;
  return { ...meta, hands };
}

export function removeDameNatureCardFromHandMeta(
  meta: DameNatureMetadata,
  playerId: number,
  cardId: string,
): DameNatureMetadata {
  const hands = { ...(meta.hands ?? {}) };
  const playerHand = [...(hands[playerId] ?? [])];
  const index = playerHand.indexOf(cardId);
  if (index >= 0) playerHand.splice(index, 1);
  hands[playerId] = playerHand;
  return { ...meta, hands };
}

export function addDameNatureCardToDiscardMeta(
  meta: DameNatureMetadata,
  cardId: string,
): DameNatureMetadata {
  const discard = [...(meta.discard ?? []), cardId];
  return { ...meta, discard };
}

export function getDameNatureCardName(cardId: string): string {
  const definition = DAME_NATURE_CARD_BY_ID[cardId];
  if (!definition) return cardId;
  if (definition.type === 'family') {
    return `${definition.familyName} (${definition.memberName})`;
  }
  if (definition.type === 'quiz') {
    return `Quiz : ${definition.question}`;
  }
  if (definition.type === 'nature') {
    return `Nature : ${definition.description}`;
  }
  return cardId;
}
