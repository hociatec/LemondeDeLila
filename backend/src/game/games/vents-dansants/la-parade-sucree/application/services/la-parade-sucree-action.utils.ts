import {
  CANDY_VALUES,
  LA_PARADE_SEQUENCE,
} from '../../model/la-parade-sucree-cards';
import type {
  CandyCounts,
  LaParadeSucreeMetadata,
} from '../../model/la-parade-sucree-state.model';

export function computeLaParadeCandyValue(
  reward: Partial<Record<string, number>>,
): number {
  let total = 0;
  for (const [key, amount] of Object.entries(reward)) {
    const candyType = key as keyof typeof CANDY_VALUES;
    total += (CANDY_VALUES[candyType] ?? 0) * (amount ?? 0);
  }
  return total;
}

export function addLaParadePlayed(
  meta: LaParadeSucreeMetadata,
  cardId: string,
): LaParadeSucreeMetadata {
  const played = [...(meta.played ?? []), cardId];
  return { ...meta, played };
}

export function removeLaParadeCardFromHand(
  meta: LaParadeSucreeMetadata,
  playerId: number,
  cardId: string,
): LaParadeSucreeMetadata {
  const hands = { ...(meta.hands ?? {}) };
  const playerHand = Array.isArray(hands[playerId]) ? [...hands[playerId]] : [];
  const index = playerHand.indexOf(cardId);
  if (index >= 0) {
    playerHand.splice(index, 1);
  }
  hands[playerId] = playerHand;
  return { ...meta, hands };
}

export function isLaParadeGameFinished(
  meta: LaParadeSucreeMetadata,
): boolean {
  const allPlayed = meta.sequenceIndex >= LA_PARADE_SEQUENCE.length;
  const noCardsLeft = Object.values(meta.hands ?? {}).every(
    (hand) => Array.isArray(hand) && hand.length === 0,
  );
  return allPlayed || noCardsLeft;
}

export function scoreLaParadeCandies(candies?: CandyCounts): number {
  if (!candies) return 0;
  let total = 0;
  for (const [type, amount] of Object.entries(candies)) {
    const candyType = type as keyof typeof CANDY_VALUES;
    total += (CANDY_VALUES[candyType] ?? 0) * (amount ?? 0);
  }
  return total;
}

export function determineLaParadeWinner(
  meta: LaParadeSucreeMetadata,
): number | null {
  let bestId: number | null = null;
  let bestScore = -Infinity;
  let tie = false;
  for (const [playerIdStr, candies] of Object.entries(meta.candies ?? {})) {
    const playerId = Number(playerIdStr);
    const value = scoreLaParadeCandies(candies);
    if (value > bestScore) {
      bestScore = value;
      bestId = playerId;
      tie = false;
      continue;
    }
    if (value === bestScore) {
      tie = true;
    }
  }
  return tie ? null : bestId;
}
