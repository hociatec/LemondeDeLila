import { gameInput, effectContentSchema } from '../../../engine/sdk/public-api';
const textSchema = gameInput.string({ min: 1, max: 4000, trim: false });
export const derapeSchema = gameInput.object({
  tiles: gameInput.array(
    gameInput.object({
      label: textSchema,
      description: textSchema,
      isNeutral: gameInput.boolean(),
    }),
    { min: 2, max: 1000 },
  ),
  cards: gameInput.array(
    gameInput.object({
      id: gameInput.number({ integer: true, min: 1 }),
      title: textSchema,
      text: textSchema,
      kind: gameInput.enum([
        'move',
        'skip',
        'special',
        'global',
        'conditional',
        'rule',
        'neutral',
      ]),
      moveDelta: gameInput.optional(
        gameInput.number({ integer: true, min: -1000000, max: 1000000 }),
      ),
      effects: effectContentSchema({
        effects: [
          'ca-derape.move',
          'ca-derape.skip-penalty',
          'ca-derape.special',
          'ca-derape.global',
          'ca-derape.conditional',
          'ca-derape.rule',
          'ca-derape.mark-winner',
        ],
      }),
    }),
    { min: 1, max: 10000 },
  ),
});
