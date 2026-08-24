import {
  GOOD_LABELS,
  inventoryValue,
} from '../../model/le-marche-des-merveilles-market';
import type { LeMarcheDesMerveillesMetadata } from '../../model/le-marche-des-merveilles-state.model';

export function describeLeMarcheScoreboardEntry(
  meta: LeMarcheDesMerveillesMetadata,
  playerId: number,
): number {
  const coins = meta.coins?.[playerId] ?? 0;
  const inventory = meta.inventories?.[playerId];
  return coins + inventoryValue(inventory, meta.prices);
}

export function determineLeMarcheWinner(
  meta: LeMarcheDesMerveillesMetadata,
): number | null {
  let bestId: number | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  let tie = false;
  for (const playerId of Object.keys(meta.coins ?? {})) {
    const numericId = Number(playerId);
    if (!Number.isFinite(numericId)) continue;
    const score = describeLeMarcheScoreboardEntry(meta, numericId);
    if (score > bestScore) {
      bestScore = score;
      bestId = numericId;
      tie = false;
      continue;
    }
    if (score === bestScore) {
      tie = true;
    }
  }
  return tie ? null : bestId;
}

export function describeLeMarcheGoodLabel(good: keyof typeof GOOD_LABELS): string {
  return GOOD_LABELS[good];
}
