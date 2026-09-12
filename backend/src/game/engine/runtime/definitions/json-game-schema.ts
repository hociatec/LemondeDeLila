import { jsonCardSelectionSchema } from './json-card-selection-schema';
import { jsonCardValueSchema } from './json-card-value-schema';
import { jsonComponent as component } from './json-component-schema-helper';
import { jsonVictorySchema } from './json-victory-schema';
import { jsonProgramExtensionSchemas } from '../extensions/json-program-extension-schemas';
import { jsonCollectionViewComponentSchema } from './json-collection-view-schema';
import { jsonContentMigrationsSchema } from './json-content-migration-schema';
import { effectJsonDefinitions } from '../contracts/effect-json-schema';
import { jsonGamePatternSchema } from './json-game-patterns';
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
  freezeAuthorSchema,
} from '../contracts/json-author-schema';

export type { JsonGameDocument } from './json-game-document';

const nonnegative: AuthorSchema = { type: 'integer', minimum: 0 };
const perPlayer: AuthorSchema = { oneOf: [number, record(number)] };
const components: AuthorSchema = {
  oneOf: [
    jsonCollectionViewComponentSchema,
    component(
      'cards.sets',
      {
        hand: id,
        deck: id,
        visibility: { enum: ['owner', 'public'] },
        sets: record(array(id, 1)),
      },
      ['hand', 'deck', 'sets'],
    ),
    component(
      'ownership.registry',
      {
        assets: array(id),
        exclusive: boolean,
        visibility: { enum: ['public', 'owner'] },
      },
      ['assets'],
    ),
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
              glyph: { type: 'string', minLength: 1, maxLength: 8 },
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
        cards: array(jsonCardValueSchema, 1),
        catalog: array(jsonCardValueSchema),
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
        acceptedDecks: array(id),
        initialDeferredCardIds: array({ oneOf: [id, number] }),
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
      snapshotMigrations: jsonContentMigrationsSchema,
      category: id,
      world: id,
      presentation: object(
        {
          score: object(
            {
              label: { type: 'string', minLength: 1, maxLength: 200 },
              unit: object({
                singular: { type: 'string', minLength: 1, maxLength: 100 },
                plural: { type: 'string', minLength: 1, maxLength: 100 },
              }),
              changeNarration: { enum: ['total', 'delta-and-total'] },
              visibility: { enum: ['always', 'active-match'] },
            },
            ['label', 'unit'],
          ),
        },
        [],
      ),
      patterns: array(jsonGamePatternSchema),
      ...jsonProgramExtensionSchemas,
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
          pawns: array(
            object(
              {
                setId: id,
                assignment: { enum: ['round-robin', 'grouped', 'random'] },
              },
              ['setId'],
            ),
          ),
          deals: array(
            object(
              {
                deckId: id,
                handId: id,
                count: { type: 'integer', minimum: 1, maximum: 1000 },
                fallbackDeckId: id,
              },
              ['deckId', 'handId', 'count'],
            ),
          ),
          gridPlacements: array(
            object(
              {
                boardId: id,
                positions: array(
                  object(
                    {
                      x: { type: 'integer', minimum: 0, maximum: 10000 },
                      y: { type: 'integer', minimum: 0, maximum: 10000 },
                    },
                    ['x', 'y'],
                  ),
                  1,
                ),
                emptyOverlays: array(id),
              },
              ['boardId', 'positions'],
            ),
          ),
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
          object(
            {
              selectCards: jsonCardSelectionSchema,
              documentation: { type: 'string', maxLength: 10000 },
            },
            ['selectCards'],
          ),
          object(
            {
              effects: array(ref('effect')),
              documentation: { type: 'string', maxLength: 10000 },
            },
            ['effects'],
          ),
          object(
            {
              recipe: {
                enum: [
                  'board-roll',
                  'board-draw',
                  'grid-place',
                  'judged-submit-card',
                  'judged-pick',
                  'event-race-roll',
                  'delivery-race-roll',
                  'goose-race-roll',
                  'collection-race-roll',
                  'ecosystem-race-roll',
                  'pirate-race-roll',
                  'parade-play',
                  'parade-pass',
                  'nature-families-ask',
                  'nature-families-pass',
                  'car-assembly-play',
                  'car-assembly-discard',
                  'car-assembly-pass',
                  'cat-pattes-draw',
                  'cat-pattes-play',
                  'cat-pattes-discard',
                  'wonder-market-buy',
                  'wonder-market-sell',
                  'wonder-market-rumor',
                  'wonder-market-protect',
                  'wonder-market-steal',
                  'wonder-market-pass',
                  'maman-race-roll',
                  'card-circles-form',
                  'card-circles-discard',
                  'card-circles-pass',
                  'mine-domain-play',
                  'mine-domain-pass',
                  'frousse-race-roll',
                  'galopons-race-roll',
                  'profession-families-request',
                  'foulees-race-roll',
                  'galaxy-race-roll',
                  'gerard-set-theme',
                  'gerard-play-name',
                  'gerard-play-special',
                  'gerard-choose-winner',
                  'gerard-pass',
                  'rites-ask-card',
                  'rites-pass',
                  'sac-roll',
                  'sac-build',
                  'sac-sell-building',
                  'sac-mortgage',
                  'sac-unmortgage',
                  'sac-pay-fine',
                  'sac-use-jail-card',
                  'midnight-race-roll',
                  'banana-troops-play',
                  'banana-troops-pass',
                  'balloon-race-roll',
                  'balloon-race-draw',
                  'voyage-roll',
                  'derape-race-roll',
                  'nawak-choose',
                  'nawak-vote',
                  'olympia-draw',
                  'olympia-play',
                  'olympia-pass',
                  'zig-et-zag-draw',
                  'mnemosyne-draw',
                  'mnemosyne-answer',
                  'mnemosyne-timeout',
                  'corridor-move',
                  'corridor-place-wall',
                  'contes-roll',
                  'lama-play',
                  'lama-draw',
                  'lama-pass',
                  'lama-quit',
                  'pawn-race-roll',
                ],
              },
              documentation: { type: 'string', maxLength: 10000 },
            },
            ['recipe'],
          ),
        ],
      }),
      victory: jsonVictorySchema,
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
