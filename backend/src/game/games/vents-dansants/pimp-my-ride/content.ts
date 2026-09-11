import {
  cardContent,
  defineGameContent,
  gameInput,
  rejectContent,
} from '../../../engine/sdk/public-api';
import data from './content-data.json';
import manifest from './manifest.json';

export type PimpMyRideCategory =
  | 'carrosserie'
  | 'roues'
  | 'moteur'
  | 'volant'
  | 'sieges'
  | 'phares'
  | 'accessoires';

export const PIMP_MY_RIDE_CATEGORY_ORDER: readonly PimpMyRideCategory[] =
  Object.freeze([
    'carrosserie',
    'roues',
    'moteur',
    'volant',
    'sieges',
    'phares',
    'accessoires',
  ]);

const rideSchema = gameInput.object({
  cards: gameInput.array(
    gameInput.object({
      id: gameInput.string({ min: 1, max: 128 }),
      name: gameInput.string({ min: 1, max: 200 }),
      category: gameInput.enum(PIMP_MY_RIDE_CATEGORY_ORDER),
    }),
    { min: 1, max: 10000 },
  ),
  carNames: gameInput.array(
    gameInput.object({
      name: gameInput.string({ min: 1, max: 200 }),
      description: gameInput.string({ max: 4000 }),
    }),
    { min: 1, max: 10000 },
  ),
});
export const PIMP_MY_RIDE_GAME_CONTENT = defineGameContent(
  manifest.code,
  data,
  {
    schema: {
      parse(value: unknown) {
        const parsed = rideSchema.parse(value);
        for (const category of PIMP_MY_RIDE_CATEGORY_ORDER) {
          if (!parsed.cards.some((card) => card.category === category))
            rejectContent('Catégorie sans pièces');
        }
        return { cards: cardContent(parsed.cards), carNames: parsed.carNames };
      },
    },
  },
);
export const PIMP_MY_RIDE_DECK = PIMP_MY_RIDE_GAME_CONTENT.data.cards;
export const PIMP_MY_RIDE_CAR_NAMES = PIMP_MY_RIDE_GAME_CONTENT.data.carNames;
export const PIMP_MY_RIDE_CARD_BY_ID = Object.freeze(
  Object.fromEntries(PIMP_MY_RIDE_DECK.map((card) => [card.id, card])),
);
