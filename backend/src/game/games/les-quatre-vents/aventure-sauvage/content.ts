import manifest from './manifest.json';
import embeddedCatalogue from './catalogue.json';

import {
  defineGameContent,
  gameInput,
  cardContent,
  effectContentSchema,
  rejectContent,
} from '../../../engine/sdk/public-api';

const textSchema = gameInput.string({ min: 1, max: 4000, trim: false });
const deckSchema = gameInput.array(
  gameInput.object({
    id: gameInput.number({ integer: true, min: 1 }),
    deck: gameInput.enum(['animal', 'patte']),
    text: textSchema,
    effects: effectContentSchema({
      tracks: ['jungle'],
      effects: ['aventure.resolve-landing'],
    }),
  }),
  { min: 1, max: 10000 },
);
const aventureSchema = gameInput.object({
  tiles: gameInput.array(
    gameInput.object({
      type: gameInput.enum(['neutral', 'animal', 'patte', 'finish']),
      label: textSchema,
    }),
    { min: 2, max: 1000 },
  ),
  pawns: gameInput.array(
    gameInput.object({
      id: gameInput.string({ min: 1, max: 128 }),
      label: textSchema,
      description: textSchema,
    }),
    { min: 6, max: 100 },
  ),
  animalCards: deckSchema,
  pawCards: deckSchema,
});
export const AVENTURE_GAME_CONTENT = defineGameContent(
  manifest.code,
  embeddedCatalogue,
  {
    snapshotMigrations: [
      {
        fromVersion: 'aventure-sauvage@content:c48df7e1',
        toVersion: 'aventure-sauvage@content:f577dff1',
      },
    ],
    schema: {
      parse(value: unknown) {
        const parsed = aventureSchema.parse(value);
        if (
          parsed.animalCards.some((card) => card.deck !== 'animal') ||
          parsed.pawCards.some((card) => card.deck !== 'patte')
        )
          rejectContent('Carte dans une pioche incorrecte');
        if (parsed.tiles.at(-1)?.type !== 'finish')
          rejectContent('Arrivée de la jungle requise');
        return {
          tiles: parsed.tiles,
          pawns: cardContent(parsed.pawns),
          animalCards: cardContent(parsed.animalCards),
          pawCards: cardContent(parsed.pawCards),
        };
      },
    },
  },
);
export const AVENTURE_TILES = AVENTURE_GAME_CONTENT.data.tiles;
export const AVENTURE_PAWNS = AVENTURE_GAME_CONTENT.data.pawns;
export const AVENTURE_ANIMAL_CARDS = AVENTURE_GAME_CONTENT.data.animalCards;
export const AVENTURE_PATTE_CARDS = AVENTURE_GAME_CONTENT.data.pawCards;
