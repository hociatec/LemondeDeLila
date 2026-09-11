import { gameInput, effectContentSchema } from '../../../engine/sdk/public-api';
const textSchema = gameInput.string({ min: 1, max: 4000, trim: false });
export const balloonsSchema = gameInput.object({
  cards: gameInput.array(
    gameInput.object({
      id: gameInput.number({ integer: true, min: 1 }),
      text: textSchema,
      retreatScore: gameInput.number({
        integer: true,
        min: -1000000,
        max: 1000000,
      }),
      effects: effectContentSchema({
        effects: [
          'a-fond-les-ballons.move',
          'a-fond-les-ballons.next-tile',
          'a-fond-les-ballons.repeat-roll',
          'a-fond-les-ballons.swap',
          'a-fond-les-ballons.go-to',
          'a-fond-les-ballons.boutique',
          'a-fond-les-ballons.random-move',
          'a-fond-les-ballons.finish-if-slide',
        ],
      }),
    }),
    { min: 1, max: 10000 },
  ),
  pawns: gameInput.array(
    gameInput.object({
      id: gameInput.string({ min: 1, max: 128 }),
      label: textSchema,
      description: textSchema,
    }),
    { min: 6, max: 100 },
  ),
  tiles: gameInput.array(
    gameInput.object({
      type: gameInput.enum([
        'start',
        'neutral',
        'bonus',
        'folie',
        'piege',
        'glissade',
        'tornade',
        'chaton',
        'finish',
      ]),
      label: textSchema,
    }),
    { min: 2, max: 1000 },
  ),
});
