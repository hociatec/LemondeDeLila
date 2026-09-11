import manifest from './manifest.json';
import embeddedCatalogue from './catalogue.json';

import { defineGameContent, gameInput } from '../../../engine/sdk/public-api';

export interface AbsurdissimesCard {
  id: string;
  text: string;
}

const cardsSchema = gameInput.array(
  gameInput.object({
    id: gameInput.string({ min: 1, max: 128 }),
    text: gameInput.string({ min: 1, max: 10000 }),
  }),
  { min: 1, max: 10000 },
);
export const ABSURDISSIMES_GAME_CONTENT = defineGameContent(
  manifest.code,
  embeddedCatalogue,
  {
    schema: gameInput.object({
      blackCards: cardsSchema,
      whiteCards: cardsSchema,
    }),
  },
);
export const WHITE_CARDS = ABSURDISSIMES_GAME_CONTENT.data.whiteCards;
export const BLACK_CARDS = ABSURDISSIMES_GAME_CONTENT.data.blackCards;
