import manifest from './manifest.json';
import embeddedCatalogue from './catalogue.json';
import {
  defineGameContent,
  cardContent,
  trackContent,
  effectContentSchema,
  gameInput,
  rejectContent,
} from '../../../engine/sdk/public-api';
import type { VoyageCard } from './types';
import { TRACK } from './constants';

const COLLECTIONS = ['legend', 'farce', 'treasure', 'landscape'] as const;
const integer = gameInput.number({ integer: true, coerce: false });
const text = gameInput.string({ trim: false });
const tileSchema = gameInput.object(
  {
    id: integer,
    title: text,
    type: gameInput.enum([
      'start',
      'finish',
      'neutral',
      'rest',
      'passage',
      ...COLLECTIONS,
    ]),
    label: gameInput.optional(text),
    description: gameInput.optional(text),
    passageEffect: gameInput.optional(
      gameInput.union([
        gameInput.object(
          { kind: gameInput.literal('swap-position') },
          { unknownKeys: 'reject' },
        ),
        gameInput.object(
          { kind: gameInput.literal('move'), delta: integer },
          { unknownKeys: 'reject' },
        ),
      ]),
    ),
  },
  { unknownKeys: 'reject' },
);
const quizSchema = gameInput.object(
  {
    choices: gameInput.array(
      gameInput.object(
        {
          id: gameInput.string({ min: 1, max: 128, trim: false }),
          label: gameInput.string({ min: 1, trim: false }),
        },
        { unknownKeys: 'reject' },
      ),
      { min: 2 },
    ),
    answerId: gameInput.string({ min: 1, max: 128, trim: false }),
    successDelta: integer,
  },
  { unknownKeys: 'reject' },
);
const cardSchema = gameInput.object(
  {
    id: integer,
    title: text,
    description: text,
    effect: text,
    effects: effectContentSchema({
      tracks: [TRACK],
      effects: [
        'voyage.swap-last-player',
        'voyage.lose-random-card',
        'voyage.schedule-target',
      ],
    }),
    collectionGain: gameInput.union([
      gameInput.literal(null),
      gameInput.enum(COLLECTIONS),
    ]),
    discardAfterResolve: gameInput.boolean(),
    quiz: gameInput.optional(quizSchema),
  },
  { unknownKeys: 'reject' },
);
const customDataSchemas = {
  'voyage.swap-last-player': gameInput.object({}, { unknownKeys: 'reject' }),
  'voyage.lose-random-card': gameInput.object(
    { allowed: gameInput.array(gameInput.enum(COLLECTIONS), { min: 1 }) },
    { unknownKeys: 'reject' },
  ),
  'voyage.schedule-target': gameInput.object(
    {
      effect: gameInput.enum(['skip-turn', 'swap-card', 'swap-position']),
      count: gameInput.number({ integer: true, min: 1, coerce: false }),
    },
    { unknownKeys: 'reject' },
  ),
};

export function parseVoyageCard(value: unknown): VoyageCard {
  const card = cardSchema.parse(value);
  const quiz = card.quiz;
  if (
    quiz &&
    (new Set(quiz.choices.map((choice) => choice.id)).size !==
      quiz.choices.length ||
      !quiz.choices.some((choice) => choice.id === quiz.answerId))
  )
    rejectContent('Invalid quiz answer identifiers');
  for (const effect of card.effects) {
    if (effect.kind === 'custom') {
      const schema = Object.entries(customDataSchemas).find(
        ([id]) => id === effect.effectId,
      )?.[1];
      if (!schema) rejectContent('Unknown Voyage effect');
      schema.parse(effect.data ?? {});
    } else if (
      (effect.kind !== 'move' && effect.kind !== 'skip-turn') ||
      effect.target?.kind !== 'self'
    )
      rejectContent('Invalid Voyage effect target');
  }
  return card;
}
const cardsSchema = gameInput.array(
  { parse: parseVoyageCard, describe: () => cardSchema.describe() },
  { min: 1 },
);
const catalogueSchema = gameInput.object(
  {
    tiles: gameInput.array(tileSchema, { min: 2 }),
    legend: cardsSchema,
    farce: cardsSchema,
    treasure: cardsSchema,
    landscape: cardsSchema,
  },
  { unknownKeys: 'reject' },
);

export const VOYAGE_GAME_CONTENT = defineGameContent(
  manifest.code,
  embeddedCatalogue,
  {
    formatVersion: 2,
    schema: {
      parse(value: unknown) {
        const content = catalogueSchema.parse(value);
        return {
          tiles: trackContent(content.tiles),
          legend: cardContent(content.legend),
          farce: cardContent(content.farce),
          treasure: cardContent(content.treasure),
          landscape: cardContent(content.landscape),
        };
      },
    },
  },
);
export const VOYAGE_CONTENT = VOYAGE_GAME_CONTENT.data;
