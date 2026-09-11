import type {
  GameComponentDefinition,
  GameInitialization,
} from './component-kit';
import type { GameEffectInstruction } from '../contracts/effect-ir';
import type { ThresholdVictory } from '../automation/threshold-victory';
import type { GameShortcutHint } from '../../../shortcuts/public-api';
import type { BoardGameProgram } from '../contracts/board-game-program';
import { jsonBoardSchema } from './json-board-schema';
import { effectJsonDefinitions } from '../contracts/effect-json-schema';
import {
  jsonGamePatternSchema,
  type JsonGamePattern,
} from './json-game-patterns';
import {
  type AuthorSchema,
  authorId as id,
  authorNumber as number,
  authorPositive as positive,
  authorBoolean as boolean,
  authorArray as array,
  authorObject as object,
  authorRecord as record,
  authorRef as ref,
  assertAuthorJson,
  validateAuthorSchema,
  freezeAuthorSchema,
} from '../contracts/json-author-schema';

export type JsonGameDocument = {
  schemaVersion: 1;
  contentVersion: string;
  definitionVersion: string;
  category: string;
  world: string;
  patterns?: readonly JsonGamePattern[];
  board?: BoardGameProgram;
  shortcuts?: readonly GameShortcutHint[];
  components: readonly Extract<
    GameComponentDefinition,
    {
      component:
        | 'cards.deck'
        | 'cards.hands'
        | 'movement.track'
        | 'dice.set'
        | 'inventory.set'
        | 'pawn.set'
        | 'quiz.bank';
    }
  >[];
  setup: Pick<
    GameInitialization,
    | 'firstPlayer'
    | 'startRound'
    | 'scores'
    | 'resources'
    | 'counters'
    | 'tracks'
  >;
  resourceIds: readonly string[];
  initialPhase: string;
  phases: Readonly<
    Record<
      string,
      {
        actions: readonly string[];
        terminal?: boolean;
        transitions?: readonly string[];
      }
    >
  >;
  actions: Readonly<
    Record<
      string,
      | { effects: readonly GameEffectInstruction[] }
      | { recipe: 'board-roll' | 'board-draw' }
    >
  >;
  victory: ThresholdVictory | { kind: 'by-board' };
};

const nonnegative: AuthorSchema = { type: 'integer', minimum: 0 };
const perPlayer: AuthorSchema = { oneOf: [number, record(number)] };
const victoryOptions = {
  participants: { enum: ['active', 'all'] },
  selection: {
    enum: ['all-qualified', 'unique-qualified', 'highest-value-lowest-id'],
  },
  reason: { type: 'string', minLength: 1, maxLength: 128 },
} satisfies Record<string, AuthorSchema>;
const component = (
  name: string,
  fields: Record<string, AuthorSchema>,
  required: string[],
) =>
  object(
    {
      component: { const: name },
      id,
      scope: { enum: ['match', 'round'] },
      ...fields,
    },
    ['component', 'id', ...required],
  );
const components: AuthorSchema = {
  oneOf: [
    component(
      'inventory.set',
      { items: array(id), visibility: { enum: ['owner', 'public'] } },
      [],
    ),
    component(
      'pawn.set',
      {
        pawns: array(
          object(
            {
              id,
              label: { type: 'string' },
              name: { type: 'string' },
              description: { type: 'string' },
            },
            ['id'],
          ),
          1,
        ),
        perPlayer: positive,
      },
      ['pawns', 'perPlayer'],
    ),
    component(
      'quiz.bank',
      {
        questions: array(
          object({
            id,
            prompt: { type: 'string' },
            choices: array({ type: 'string' }, 2),
            answerIndex: nonnegative,
          }),
          1,
        ),
        shuffle: boolean,
        autoReveal: { enum: ['all-answered', 'manual'] },
      },
      ['questions'],
    ),
    component(
      'cards.deck',
      {
        cards: array(
          {
            oneOf: [
              id,
              { type: 'integer' },
              object(
                {
                  id,
                  label: { type: 'string' },
                  effectDescription: { type: 'string' },
                  effects: array(ref('effect')),
                },
                ['id'],
              ),
            ],
          },
          1,
        ),
        shuffle: boolean,
        empty: { enum: ['exhaust', 'recycle'] },
      },
      ['cards'],
    ),
    component(
      'cards.hands',
      {
        deck: id,
        initial: nonnegative,
        visibility: { enum: ['owner', 'public'] },
        ownerVisibility: { enum: ['always', 'active-round'] },
      },
      ['deck', 'initial', 'visibility'],
    ),
    component(
      'movement.track',
      {
        spaces: positive,
        finish: nonnegative,
        overshoot: { enum: ['clamp', 'wrap', 'bounce', 'exact'] },
        homeStretch: object({ from: nonnegative, to: nonnegative }, ['from']),
        landingEffects: record(array(ref('effect'))),
      },
      ['spaces'],
    ),
    component(
      'dice.set',
      {
        count: { type: 'integer', minimum: 1, maximum: 100 },
        sides: { type: 'integer', minimum: 2, maximum: 1000000 },
      },
      ['count', 'sides'],
    ),
  ],
};

export const jsonGameSchema = freezeAuthorSchema({
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'urn:lila:game:1',
  ...object(
    {
      schemaVersion: { const: 1 },
      contentVersion: id,
      definitionVersion: id,
      category: id,
      world: id,
      patterns: array(jsonGamePatternSchema),
      board: jsonBoardSchema,
      shortcuts: array({
        oneOf: [
          object(
            {
              type: { const: 'action' },
              key: id,
              actionType: id,
              label: { type: 'string' },
            },
            ['type', 'key', 'actionType'],
          ),
          object(
            {
              type: { const: 'interface' },
              key: id,
              id,
              label: { type: 'string' },
            },
            ['type', 'key', 'id'],
          ),
        ],
      }),
      components: array(components),
      setup: object(
        {
          firstPlayer: {
            oneOf: [{ enum: ['first', 'random'] }, { type: 'integer' }],
          },
          startRound: boolean,
          scores: perPlayer,
          resources: record(perPlayer),
          counters: record(number),
          tracks: record(perPlayer),
        },
        [],
      ),
      resourceIds: array(id),
      initialPhase: id,
      phases: record(
        object(
          { actions: array(id), terminal: boolean, transitions: array(id) },
          ['actions'],
        ),
      ),
      actions: record({
        oneOf: [
          object({ effects: array(ref('effect')) }),
          object({ recipe: { enum: ['board-roll', 'board-draw'] } }),
        ],
      }),
      victory: {
        oneOf: [
          object({ kind: { const: 'by-board' } }),
          object(
            {
              ...victoryOptions,
              kind: { const: 'score-at-least' },
              amount: { type: 'number', minimum: 1 },
            },
            ['kind', 'amount'],
          ),
          object(
            {
              ...victoryOptions,
              kind: { const: 'resource-at-least' },
              resource: id,
              amount: { type: 'number', minimum: 1 },
            },
            ['kind', 'resource', 'amount'],
          ),
        ],
      },
    },
    [
      'schemaVersion',
      'contentVersion',
      'definitionVersion',
      'category',
      'world',
      'components',
      'setup',
      'resourceIds',
      'initialPhase',
      'phases',
      'actions',
      'victory',
    ],
  ),
  $defs: effectJsonDefinitions,
});

export function parseJsonGame(
  value: unknown,
  path = 'game.json',
): JsonGameDocument {
  assertAuthorJson(value, path);
  validateAuthorSchema(value, jsonGameSchema, effectJsonDefinitions, path);
  // Only the boundary validated by the closed grammar above may narrow unknown.
  return structuredClone(value) as JsonGameDocument;
}
