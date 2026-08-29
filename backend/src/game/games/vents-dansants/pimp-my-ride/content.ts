import {
  freezeGameContent,
  rejectContent,
} from '../../../engine/sdk/public-api';
import data from './content-data.json';

export type PimpMyRideCategory =
  | 'carrosserie'
  | 'roues'
  | 'moteur'
  | 'volant'
  | 'sieges'
  | 'phares'
  | 'accessoires';

export interface PimpMyRideCardDefinition {
  id: string;
  name: string;
  category: PimpMyRideCategory;
}

export interface PimpMyRideCarName {
  name: string;
  description: string;
}

export const PIMP_MY_RIDE_CATEGORY_ORDER: PimpMyRideCategory[] = [
  'carrosserie',
  'roues',
  'moteur',
  'volant',
  'sieges',
  'phares',
  'accessoires',
];

export const PIMP_MY_RIDE_DECK: PimpMyRideCardDefinition[] = data.cards.map(
  (card) => ({ ...card, category: category(card.category) }),
);
export const PIMP_MY_RIDE_CARD_BY_ID = Object.fromEntries(
  PIMP_MY_RIDE_DECK.map((card) => [card.id, card]),
);
export const PIMP_MY_RIDE_CAR_NAMES: PimpMyRideCarName[] = data.carNames.map(
  (car) => ({ ...car }),
);

function category(value: string): PimpMyRideCategory {
  const found = PIMP_MY_RIDE_CATEGORY_ORDER.find(
    (candidate) => candidate === value,
  );
  if (!found) rejectContent(`Catégorie Pimp My Ride inconnue: ${value}`);
  return found;
}

freezeGameContent(PIMP_MY_RIDE_CATEGORY_ORDER);
freezeGameContent(PIMP_MY_RIDE_DECK);
freezeGameContent(PIMP_MY_RIDE_CARD_BY_ID);
freezeGameContent(PIMP_MY_RIDE_CAR_NAMES);
