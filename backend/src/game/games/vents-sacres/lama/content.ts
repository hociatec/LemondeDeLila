import { freezeGameContent } from '../../../core/application/public-api';

export type LamaCard = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const LAMA_VALUE: LamaCard = 7;
export const LAMA_CARD_VALUES: LamaCard[] = [1, 2, 3, 4, 5, 6, LAMA_VALUE];
export const LAMA_MAX_DECK = LAMA_CARD_VALUES.flatMap((value) =>
  Array.from({ length: 20 }, () => value),
);

export function lamaLabel(value: LamaCard): string {
  return value === LAMA_VALUE ? 'LAMA' : String(value);
}

export function lamaPenalty(value: LamaCard): number {
  return value === LAMA_VALUE ? 10 : value;
}

export function nextLamaValue(value: LamaCard): LamaCard {
  if (value === 6) return LAMA_VALUE;
  if (value === LAMA_VALUE) return 1;
  if (value === 1) return 2;
  if (value === 2) return 3;
  if (value === 3) return 4;
  if (value === 4) return 5;
  return 6;
}

export function buildLamaDeck(copiesPerValue: number): LamaCard[] {
  return LAMA_CARD_VALUES.flatMap((value) =>
    Array.from({ length: copiesPerValue }, () => value),
  );
}

freezeGameContent(LAMA_CARD_VALUES);
freezeGameContent(LAMA_MAX_DECK);
