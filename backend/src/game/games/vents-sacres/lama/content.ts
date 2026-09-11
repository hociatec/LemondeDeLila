import manifest from './manifest.json';
import {
  defineGameContent,
  gameInput,
  rejectContent,
} from '../../../engine/sdk/public-api';

export type LamaCard = 1 | 2 | 3 | 4 | 5 | 6 | 'LAMA';

export const LAMA_VALUE = 'LAMA' as const satisfies LamaCard;
export const LAMA_NUMBER_VALUES = Object.freeze([1, 2, 3, 4, 5, 6] as const);
export const LAMA_CARD_VALUES: readonly LamaCard[] = Object.freeze([
  1,
  2,
  3,
  4,
  5,
  6,
  LAMA_VALUE,
]);
const defaultDeck = LAMA_CARD_VALUES.flatMap((value) =>
  Array.from({ length: 20 }, () => value),
);
const lamaSchema = gameInput.object({
  cards: gameInput.array(
    gameInput.union([
      gameInput.numberEnum(LAMA_NUMBER_VALUES),
      gameInput.literal(LAMA_VALUE),
    ]),
    { min: 140, max: 140 },
  ),
});
export const LAMA_GAME_CONTENT = defineGameContent(
  manifest.code,
  { cards: defaultDeck },
  {
    schema: {
      parse(value: unknown) {
        const parsed = lamaSchema.parse(value);
        for (const card of LAMA_CARD_VALUES) {
          if (parsed.cards.filter((value) => value === card).length !== 20)
            rejectContent(
              'Le paquet maximal doit contenir vingt exemplaires de chaque valeur',
            );
        }
        return parsed;
      },
    },
  },
);
export const LAMA_MAX_DECK = LAMA_GAME_CONTENT.data.cards;

export function lamaLabel(value: LamaCard): string {
  return String(value);
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
  if (
    !Number.isSafeInteger(copiesPerValue) ||
    copiesPerValue < 1 ||
    copiesPerValue > 20
  )
    rejectContent('Nombre de copies LAMA invalide');
  const counts = new Map<LamaCard, number>();
  return LAMA_MAX_DECK.filter((value) => {
    const count = counts.get(value) ?? 0;
    counts.set(value, count + 1);
    return count < copiesPerValue;
  });
}
