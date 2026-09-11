import { gameInput, effectContentSchema } from '../../../engine/sdk/public-api';
const textSchema = gameInput.string({ min: 1, max: 4000, trim: false });
export const galoponsSchema = gameInput.object({
  cards: gameInput.array(
    gameInput.object({
      id: gameInput.number({ integer: true, min: 1 }),
      text: textSchema,
      effects: effectContentSchema({
        effects: [
          'galopons.move',
          'galopons.move-to-region',
          'galopons.give-apple',
          'galopons.help-advance',
          'galopons.pair-advance',
        ],
      }),
    }),
    { min: 1, max: 10000 },
  ),
  pawns: gameInput.array(
    gameInput.object({
      id: gameInput.string({ min: 1, max: 128 }),
      name: textSchema,
      description: textSchema,
    }),
    { min: 4, max: 100 },
  ),
  tiles: gameInput.array(
    gameInput.object({
      n: gameInput.number({ integer: true, min: 1 }),
      title: textSchema,
      type: gameInput.enum([
        'start',
        'neutral',
        'card',
        'bonus',
        'skip',
        'finish',
      ]),
      region: gameInput.enum(['prairie', 'riviere', 'foret', 'montagne']),
      apples: gameInput.number({ integer: true, min: 0, max: 1000 }),
      skipTurns: gameInput.number({ integer: true, min: 0, max: 1000 }),
    }),
    { min: 2, max: 1000 },
  ),
});
