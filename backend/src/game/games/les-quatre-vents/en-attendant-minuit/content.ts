export type MinuitQuiz = {
  prompt: string;
  choices: [string, string, string];
  correctIndex: number;
  successDelta: number;
  failureDelta: number;
  anyCorrect?: boolean;
};
export type MinuitTileType =
  'start' | 'neutral' | 'card' | 'move' | 'skip' | 'finish';
import canonicalContent from './catalogue.json';
import manifest from './manifest.json';

import {
  cardContent,
  defineGameContent,
  effectContentSchema,
  gameInput,
  rejectContent,
} from '../../../engine/sdk/public-api';

import type { GameEffectInstruction } from '../../../engine/sdk/public-api';

export type MinuitCard = {
  id: number;
  title: string;
  effects: readonly GameEffectInstruction[];
  quiz?: MinuitQuiz;
};

const textSchema = gameInput.string({ min: 1, max: 4000, trim: false });

const deltaSchema = gameInput.number({
  integer: true,
  min: -1000000,
  max: 1000000,
});

const quizSchema = gameInput.object({
  prompt: textSchema,
  choices: gameInput.array(textSchema, { min: 3, max: 3 }),
  correctIndex: gameInput.number({ integer: true, min: 0, max: 2 }),
  successDelta: deltaSchema,
  failureDelta: deltaSchema,
  anyCorrect: gameInput.optional(gameInput.boolean()),
});

const minuitSchema = gameInput.object({
  cards: gameInput.array(
    gameInput.object({
      id: gameInput.number({ integer: true, min: 1 }),
      title: textSchema,
      effects: effectContentSchema({
        tracks: ['minuit'],
        effects: [
          'minuit.move',
          'minuit.roll',
          'minuit.move-to-type',
          'minuit.gift',
          'minuit.swap',
          'minuit.swap-behind',
        ],
      }),
      quiz: gameInput.optional({
        parse(value: unknown): MinuitQuiz {
          const parsed = quizSchema.parse(value);
          return {
            ...parsed,
            choices: [parsed.choices[0], parsed.choices[1], parsed.choices[2]],
          };
        },
        describe: () => quizSchema.describe(),
      }),
    }),
    { min: 1, max: 10000 },
  ),
  tiles: gameInput.array(
    gameInput.object({
      n: gameInput.number({ integer: true, min: 1 }),
      title: textSchema,
      type: gameInput.enum([
        'start',
        'neutral',
        'card',
        'move',
        'skip',
        'finish',
      ]),
      delta: deltaSchema,
      skipTurns: gameInput.number({ integer: true, min: 0, max: 1000 }),
    }),
    { min: 2, max: 1000 },
  ),
  pawns: gameInput.array(
    gameInput.object({
      id: gameInput.string({ min: 1, max: 128 }),
      name: textSchema,
    }),
    { min: 6, max: 100 },
  ),
});

export const MINUIT_GAME_CONTENT = defineGameContent(
  manifest.code,
  canonicalContent,
  {
    schema: {
      parse(value: unknown) {
        const parsed = minuitSchema.parse(value);
        if (
          parsed.tiles.some((tile, index) => tile.n !== index + 1) ||
          parsed.tiles[0].type !== 'start' ||
          parsed.tiles.at(-1)?.type !== 'finish'
        )
          rejectContent('Piste de Minuit invalide');
        return {
          tiles: parsed.tiles,
          pawns: cardContent(parsed.pawns),
          cards: cardContent(parsed.cards),
        };
      },
    },
  },
);

export const MINUIT_TILES = MINUIT_GAME_CONTENT.data.tiles;

export const MINUIT_PAWNS = MINUIT_GAME_CONTENT.data.pawns;

export const MINUIT_CARDS = MINUIT_GAME_CONTENT.data.cards;
