import {
  cardContent,
  defineGameContent,
  gameInput,
  rejectContent,
} from '../../../engine/sdk/public-api';
import manifest from './manifest.json';
import type { CandyCounts, ParadeCandyType } from './types';

export interface ParadeCard {
  id: string;
  name: string;
  value: string;
  special: boolean;
}

const defaultSequence = [
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'V',
  'D',
  'R',
  'A',
] as const;

const defaultCards: readonly ParadeCard[] = [
  {
    id: 'parade-2',
    name: 'Jacques – Le Tambourinaire',
    value: '2',
    special: false,
  },
  { id: 'parade-3', name: 'Rémi – Le Jongleur', value: '3', special: false },
  {
    id: 'parade-4',
    name: 'Tina – La Danseuse Colorée',
    value: '4',
    special: false,
  },
  {
    id: 'parade-5',
    name: 'Mélissa – La Lanceuse de Bonbons',
    value: '5',
    special: false,
  },
  { id: 'parade-6', name: 'Nico – L’Acrobate', value: '6', special: false },
  { id: 'parade-7', name: 'Farou – Le Farceur', value: '7', special: true },
  {
    id: 'parade-8',
    name: 'Laura – Le Masque Mystérieux',
    value: '8',
    special: false,
  },
  { id: 'parade-9', name: 'Francis – Le Pêcheur', value: '9', special: false },
  {
    id: 'parade-10',
    name: 'Roland – Le Roi du Carnaval',
    value: '10',
    special: true,
  },
  { id: 'parade-v', name: 'Dimitri – Le Bouffon', value: 'V', special: true },
  {
    id: 'parade-d',
    name: 'Daniella – La Reine du Bal',
    value: 'D',
    special: true,
  },
  {
    id: 'parade-r',
    name: 'Fabien – Le Capitaine de la Parade',
    value: 'R',
    special: true,
  },
  {
    id: 'parade-a',
    name: 'Régis – Le Trompettiste',
    value: 'A',
    special: false,
  },
];

const paradeSchema = gameInput.object({
  sequence: gameInput.array(gameInput.string({ min: 1, max: 128 }), {
    min: 1,
    max: 1000,
  }),
  cards: gameInput.array(
    gameInput.object({
      id: gameInput.string({ min: 1, max: 128 }),
      name: gameInput.string({ min: 1, max: 200 }),
      value: gameInput.string({ min: 1, max: 128 }),
      special: gameInput.boolean(),
    }),
    { min: 1, max: 1000 },
  ),
});
export const PARADE_GAME_CONTENT = defineGameContent(
  manifest.code,
  { cards: defaultCards, sequence: defaultSequence },
  {
    schema: {
      parse(value: unknown) {
        const parsed = paradeSchema.parse(value);
        const values = new Set(parsed.cards.map((card) => card.value));
        if (
          values.size !== parsed.cards.length ||
          new Set(parsed.sequence).size !== parsed.sequence.length ||
          values.size !== parsed.sequence.length ||
          parsed.sequence.some((value) => !values.has(value))
        )
          rejectContent(
            'La séquence doit référencer chaque valeur de carte exactement une fois',
          );
        return { cards: cardContent(parsed.cards), sequence: parsed.sequence };
      },
    },
  },
);
export const PARADE_CARDS = PARADE_GAME_CONTENT.data.cards;
export const PARADE_SEQUENCE = PARADE_GAME_CONTENT.data.sequence;
export const PARADE_CARD_BY_ID: Readonly<Record<string, ParadeCard>> =
  Object.freeze(
    Object.fromEntries(PARADE_CARDS.map((card) => [card.id, card])),
  );

export const SPECIAL_REWARDS: Readonly<
  Record<string, Partial<Record<ParadeCandyType, number>>>
> = Object.freeze({
  '7': Object.freeze({ Chocobon: 1 }),
  '10': Object.freeze({ Chamallow: 1 }),
  V: Object.freeze({ Chamallow: 2 }),
  D: Object.freeze({ Chamallow: 3 }),
  R: Object.freeze({ Chamallow: 4 }),
});

export const CANDY_VALUES: Readonly<CandyCounts> = Object.freeze({
  Chamallow: 1,
  Chocobon: 5,
  Balisto: 10,
});

export const CANDY_TYPES: readonly ParadeCandyType[] = Object.freeze([
  'Chamallow',
  'Chocobon',
  'Balisto',
]);
