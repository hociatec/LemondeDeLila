import manifest from './manifest.json';
import embeddedCatalogue from './catalogue.json';
import {
  defineGameContent,
  cardContent,
  effectContentSchema,
  gameInput,
  rejectContent,
} from '../../../engine/sdk/public-api';

const integer = gameInput.number({ integer: true, coerce: false });
const text = gameInput.string({ trim: false });
const tileSchema = gameInput.object(
  {
    n: integer,
    title: text,
    type: gameInput.enum([
      'start',
      'neutral',
      'question',
      'challenge',
      'event',
      'move',
      'skip',
      'finish',
      'swapNearest',
      'goto',
    ]),
    delta: gameInput.optional(integer),
    turnsToSkip: gameInput.optional(integer),
    target: gameInput.optional(integer),
    keepTurn: gameInput.optional(gameInput.boolean()),
  },
  { unknownKeys: 'reject' },
);
const choiceSchema = gameInput.object(
  {
    id: integer,
    title: text,
    prompt: text,
    choices: gameInput.array(text, { min: 2 }),
    correctIndex: integer,
    correctDelta: integer,
    wrongDelta: integer,
  },
  { unknownKeys: 'reject' },
);
const eventSchema = gameInput.object(
  {
    id: integer,
    title: text,
    description: text,
    effects: effectContentSchema({
      effects: [
        'mission-galaxie.move',
        'mission-galaxie.goto',
        'mission-galaxie.choose-player-move',
      ],
    }),
    moveDeltas: gameInput.optional(gameInput.array(integer)),
  },
  { unknownKeys: 'reject' },
);
const catalogueSchema = gameInput.object(
  {
    tiles: gameInput.array(tileSchema, { min: 2 }),
    questions: gameInput.array(choiceSchema, { min: 1 }),
    challenges: gameInput.array(choiceSchema, { min: 1 }),
    events: gameInput.array(eventSchema, { min: 1 }),
  },
  { unknownKeys: 'reject' },
);

export const MISSION_GALAXIE_GAME_CONTENT = defineGameContent(
  manifest.code,
  embeddedCatalogue,
  {
    snapshotMigrations: [
      {
        fromVersion: 'mission-galaxie@content:6a876766',
        toVersion: 'mission-galaxie@content:1b17e6f9',
      },
    ],
    schema: {
      parse(value: unknown) {
        const content = catalogueSchema.parse(value);
        const { tiles, questions, challenges, events } = content;
        const positions = new Set(tiles.map((tile) => tile.n));
        if (
          positions.size !== tiles.length ||
          tiles[0].type !== 'start' ||
          tiles.at(-1)?.type !== 'finish'
        )
          rejectContent('Invalid Mission Galaxie track');
        for (const tile of tiles) {
          if (
            tile.type === 'goto' &&
            (tile.target === undefined || !positions.has(tile.target))
          )
            rejectContent('Unknown tile destination');
        }
        for (const card of [...questions, ...challenges]) {
          if (card.correctIndex < 0 || card.correctIndex >= card.choices.length)
            rejectContent('Invalid correct answer index');
        }
        return {
          tiles,
          questions: cardContent(questions),
          challenges: cardContent(challenges),
          events: cardContent(events),
        };
      },
    },
  },
);
export const MISSION_GALAXIE_CONTENT = MISSION_GALAXIE_GAME_CONTENT.data;
