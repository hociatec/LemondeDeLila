import manifest from './manifest.json';
import embeddedCatalogue from './catalogue.json';

import {
  defineGameContent,
  gameInput,
  cardContent,
  trackContent,
  rejectContent,
} from '../../../engine/sdk/public-api';

const labelSchema = gameInput.string({ min: 1, max: 200 });
const idSchema = gameInput.string({ min: 1, max: 128 });
const fouleesSchema = gameInput.object({
  board: gameInput.object({
    trackLength: gameInput.number({ integer: true, min: 4, max: 1000 }),
    homeLength: gameInput.number({ integer: true, min: 1, max: 6 }),
    tiles: gameInput.array(
      gameInput.object({ id: idSchema, label: labelSchema }),
      { min: 4, max: 1000 },
    ),
    safeTiles: gameInput.array(
      gameInput.number({ integer: true, min: 0, max: 999 }),
      { max: 1000 },
    ),
  }),
  families: gameInput.array(
    gameInput.object({
      id: idSchema,
      family: labelSchema,
      habitat: labelSchema,
      pawns: gameInput.array(labelSchema, { min: 4, max: 4 }),
    }),
    { min: 4, max: 4 },
  ),
  pawns: gameInput.array(
    gameInput.object({ id: idSchema, label: labelSchema }),
    { min: 16, max: 16 },
  ),
  seatColors: gameInput.array(labelSchema, { min: 4, max: 4 }),
});
export const FOULEES_GAME_CONTENT = defineGameContent(
  manifest.code,
  embeddedCatalogue,
  {
    schema: {
      parse(value: unknown) {
        const parsed = fouleesSchema.parse(value);
        if (
          parsed.board.tiles.length !== parsed.board.trackLength ||
          parsed.board.safeTiles.some(
            (index) => index >= parsed.board.trackLength,
          ) ||
          new Set(parsed.board.safeTiles).size !== parsed.board.safeTiles.length
        )
          rejectContent('Cases de piste incohérentes');
        const families = cardContent(parsed.families);
        if (families.some((family) => family.id.includes(':')))
          rejectContent('Identifiant de famille invalide');
        const expectedPawns = families.flatMap((family) =>
          family.pawns.map((label, index) => ({
            id: `${family.id}:${index}`,
            label,
          })),
        );
        if (
          parsed.pawns.length !== expectedPawns.length ||
          parsed.pawns.some(
            (pawn, index) =>
              pawn.id !== expectedPawns[index].id ||
              pawn.label !== expectedPawns[index].label,
          )
        )
          rejectContent('Les pions doivent correspondre aux familles');
        return {
          ...parsed,
          families,
          pawns: cardContent(parsed.pawns),
          board: { ...parsed.board, tiles: trackContent(parsed.board.tiles) },
        };
      },
    },
  },
);
export const FOULEES_FAMILIES = FOULEES_GAME_CONTENT.data.families;
export const FOULEES_PAWNS = FOULEES_GAME_CONTENT.data.pawns;
export const FOULEES_BOARD = FOULEES_GAME_CONTENT.data.board;
