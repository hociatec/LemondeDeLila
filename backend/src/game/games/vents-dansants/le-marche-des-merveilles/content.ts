import {
  defineGameContent,
  gameInput,
  rejectContent,
} from '../../../engine/sdk/public-api';
import manifest from './manifest.json';
import type { WonderGood, WonderPrices } from './types';

const defaultGoods: readonly WonderGood[] = [
  'gemmes',
  'potions',
  'reliques',
  'ingredients',
];

const defaultLabels: Readonly<Record<WonderGood, string>> = {
  gemmes: 'Gemmes',
  potions: 'Potions',
  reliques: 'Reliques',
  ingredients: 'Ingrédients',
};

const defaultPrices: WonderPrices = {
  gemmes: 5,
  potions: 4,
  reliques: 7,
  ingredients: 3,
};

const defaultRules = {
  startingCoins: 12,
  maxRounds: 6,
  protectCost: 2,
  rumorCost: 1,
} as const;

const label = gameInput.string({ min: 1, max: 200 });
const price = gameInput.number({ integer: true, min: 1, max: 10 });
const cost = gameInput.number({ integer: true, min: 0, max: 1000000 });
const marketSchema = gameInput.object({
  goods: gameInput.array(
    gameInput.enum(['gemmes', 'potions', 'reliques', 'ingredients']),
    { min: 4, max: 4 },
  ),
  labels: gameInput.object({
    gemmes: label,
    potions: label,
    reliques: label,
    ingredients: label,
  }),
  initialPrices: gameInput.object({
    gemmes: price,
    potions: price,
    reliques: price,
    ingredients: price,
  }),
  rules: gameInput.object({
    startingCoins: cost,
    maxRounds: gameInput.number({ integer: true, min: 1, max: 1000 }),
    protectCost: cost,
    rumorCost: cost,
  }),
});
export const WONDER_GAME_CONTENT = defineGameContent(
  manifest.code,
  {
    goods: defaultGoods,
    labels: defaultLabels,
    initialPrices: defaultPrices,
    rules: defaultRules,
  },
  {
    schema: {
      parse(value: unknown) {
        const parsed = marketSchema.parse(value);
        if (new Set(parsed.goods).size !== 4)
          rejectContent(
            'Chaque marchandise doit apparaître exactement une fois',
          );
        return parsed;
      },
    },
  },
);
export const WONDER_GOODS = WONDER_GAME_CONTENT.data.goods;
export const INITIAL_PRICES = WONDER_GAME_CONTENT.data.initialPrices;
export const MARKET_RULES = WONDER_GAME_CONTENT.data.rules;
