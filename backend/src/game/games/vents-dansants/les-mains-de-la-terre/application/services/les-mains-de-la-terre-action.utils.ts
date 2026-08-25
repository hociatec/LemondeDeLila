import type { DeckPoliciesService } from '../../../../../deck-policies/application/services/deck-policies.service';
import type { RandomService } from '../../../../../core/application/services/random.service';

import type { LesMainsMetadata } from '../../model/les-mains-de-la-terre-state.model';

export function transferLesMainsCard(
  meta: LesMainsMetadata,
  fromId: number,
  toId: number,
  cardId: string,
): LesMainsMetadata {
  const fromHand = Array.isArray(meta.hands?.[fromId])
    ? [...meta.hands[fromId]]
    : [];
  const toHand = Array.isArray(meta.hands?.[toId]) ? [...meta.hands[toId]] : [];
  const index = fromHand.indexOf(cardId);
  if (index >= 0) {
    fromHand.splice(index, 1);
  }
  return {
    ...meta,
    hands: {
      ...meta.hands,
      [fromId]: fromHand,
      [toId]: [...toHand, cardId],
    },
  };
}

export function addLesMainsCardToHand(
  meta: LesMainsMetadata,
  playerId: number,
  cardId: string,
): LesMainsMetadata {
  const hand = Array.isArray(meta.hands?.[playerId])
    ? [...meta.hands[playerId]]
    : [];
  return {
    ...meta,
    hands: {
      ...meta.hands,
      [playerId]: [...hand, cardId],
    },
  };
}

export function drawLesMainsOneCard(
  deckPolicies: DeckPoliciesService,
  meta: LesMainsMetadata,
): {
  cardId: string | null;
  meta: LesMainsMetadata;
} {
  const draw = deckPolicies.drawOne<string, LesMainsMetadata>({
    meta,
    deckKey: 'deck',
    discardKey: 'discard',
    rngKey: 'rng',
  });
  return { cardId: draw.card, meta: draw.meta };
}

export function pickLesMainsIndex(
  random: RandomService,
  meta: LesMainsMetadata,
  length: number,
): { index: number; meta: LesMainsMetadata } {
  if (length <= 0) {
    return { index: 0, meta };
  }
  const seed = meta.rng ?? {};
  const result = random.pickIndex(seed, length);
  return { index: result.index, meta: { ...meta, rng: result.meta } };
}

export function shuffleLesMainsWithMeta<T>(
  random: RandomService,
  meta: LesMainsMetadata,
  values: T[],
): { values: T[]; meta: LesMainsMetadata } {
  const shuffled = random.shuffle(meta.rng ?? {}, values);
  return { values: shuffled.values, meta: { ...meta, rng: shuffled.meta } };
}

export function clearLesMainsFreeRequest(
  meta: LesMainsMetadata,
  playerId: number,
): LesMainsMetadata {
  if (!meta.freeFamilyRequest?.[playerId]) {
    return meta;
  }
  return {
    ...meta,
    freeFamilyRequest: {
      ...meta.freeFamilyRequest,
      [playerId]: false,
    },
  };
}
