import type {
  EffectCondition,
  EffectTarget,
  GameEffectInstruction,
} from './effect-ir';
import {
  type AuthorSchema,
  authorId as id,
  authorNumber as number,
  authorInteger as integer,
  authorPositive as positive,
  authorBoolean as boolean,
  authorRef as ref,
  authorArray as array,
  authorObject as object,
  authorRecord as record,
  assertAuthorJson,
  validateAuthorSchema,
  freezeAuthorSchema,
} from './json-author-schema';

const target = ref('target');
const effects = array(ref('effect'));
const variant = (
  kind: string,
  fields: Record<string, AuthorSchema> = {},
  required = Object.keys(fields),
) => object({ kind: { const: kind }, ...fields }, ['kind', ...required]);
const targeted = (
  kind: string,
  fields: Record<string, AuthorSchema>,
  required = Object.keys(fields),
) => variant(kind, { ...fields, target }, required);

const targets = {
  self: variant('self'),
  player: variant('player', { playerId: integer }),
  next: variant('next', { order: { enum: ['seating', 'turn'] } }, []),
  previous: variant('previous', { order: { enum: ['seating', 'turn'] } }, []),
  'random-player': variant('random-player'),
  leader: variant('leader', { ties: { enum: ['all', 'lowest-id', 'random'] } }),
  last: variant('last', { ties: { enum: ['all', 'lowest-id', 'random'] } }),
  'all-players': variant('all-players'),
  'all-opponents': variant('all-opponents'),
  'random-opponent': variant('random-opponent'),
  'chosen-opponent': variant(
    'chosen-opponent',
    { choiceId: id, optional: boolean, chooserPlayerId: integer },
    [],
  ),
  'chosen-player': variant(
    'chosen-player',
    {
      playerIds: array(integer, 1),
      choiceId: id,
      optional: boolean,
      chooserPlayerId: integer,
    },
    ['playerIds'],
  ),
} satisfies Record<EffectTarget['kind'], AuthorSchema>;

const conditions = {
  score: targeted('score', {
    compare: { enum: ['eq', 'ne', 'lt', 'lte', 'gt', 'gte'] },
    amount: number,
  }),
  resource: targeted('resource', {
    resource: id,
    compare: { enum: ['eq', 'ne', 'lt', 'lte', 'gt', 'gte'] },
    amount: number,
  }),
  'inventory-count': targeted(
    'inventory-count',
    {
      inventoryId: id,
      itemId: id,
      compare: { enum: ['eq', 'ne', 'lt', 'lte', 'gt', 'gte'] },
      amount: { type: 'integer', minimum: 0 },
    },
    ['inventoryId', 'compare', 'amount'],
  ),
  'owns-asset': targeted('owns-asset', { registryId: id, assetId: id }),
  'has-resource': targeted('has-resource', {
    resource: id,
    amount: { type: 'number', minimum: 0 },
  }),
  'has-status': targeted('has-status', { status: id }),
  'track-position': targeted(
    'track-position',
    { trackId: id, position: integer, min: integer, max: integer },
    ['trackId'],
  ),
  'has-card': targeted('has-card', { handId: id, cardId: id }, ['handId']),
  not: variant('not', { condition: ref('condition') }),
  all: variant('all', { conditions: array(ref('condition'), 1) }),
  any: variant('any', { conditions: array(ref('condition'), 1) }),
} satisfies Record<EffectCondition['kind'], AuthorSchema>;

const instructions = {
  conditional: variant(
    'conditional',
    { condition: ref('condition'), then: effects, else: effects },
    ['condition', 'then'],
  ),
  reaction: variant(
    'reaction',
    {
      choiceId: id,
      reactor: target,
      options: array(id, 1),
      availability: ref('availability'),
      reactions: record(effects),
      fallback: effects,
    },
    ['reactor', 'options', 'reactions'],
  ),
  'choose-player': variant(
    'choose-player',
    { choiceId: id, candidates: { enum: ['opponents', 'active-players'] } },
    [],
  ),
  move: targeted('move', { trackId: id, spaces: integer }),
  'move-to': targeted('move-to', { trackId: id, position: integer }),
  'draw-cards': targeted(
    'draw-cards',
    { deckId: id, handId: id, count: positive, recycle: boolean },
    ['deckId', 'handId', 'count'],
  ),
  'discard-random': targeted('discard-random', {
    deckId: id,
    handId: id,
    count: positive,
  }),
  'discard-random-inventory': targeted('discard-random-inventory', {
    inventoryId: id,
    count: positive,
  }),
  'gain-resource': targeted('gain-resource', {
    resource: id,
    amount: { type: 'number', minimum: 0 },
  }),
  'lose-resource': targeted(
    'lose-resource',
    {
      resource: id,
      amount: { type: 'number', minimum: 0 },
      allowPartial: boolean,
    },
    ['resource', 'amount'],
  ),
  'transfer-resource': variant('transfer-resource', {
    resource: id,
    amount: { type: 'number', minimum: 0 },
    from: target,
    to: target,
  }),
  'exchange-resources': variant('exchange-resources', {
    left: target,
    right: target,
    leftOffer: object({ resource: id, amount: positive }, [
      'resource',
      'amount',
    ]),
    rightOffer: object({ resource: id, amount: positive }, [
      'resource',
      'amount',
    ]),
  }),
  'give-card': variant('give-card', {
    handId: id,
    cardId: id,
    from: target,
    to: target,
  }),
  'steal-card': variant(
    'steal-card',
    { handId: id, count: positive, from: target, to: target },
    ['handId', 'from'],
  ),
  'swap-hands': variant('swap-hands', {
    handId: id,
    left: target,
    right: target,
  }),
  'exchange-random-cards': variant('exchange-random-cards', {
    handId: id,
    left: target,
    right: target,
  }),
  'steal-random-inventory': variant(
    'steal-random-inventory',
    { inventoryId: id, count: positive, from: target, to: target },
    ['inventoryId', 'from'],
  ),
  'swap-inventories': variant('swap-inventories', {
    inventoryId: id,
    left: target,
    right: target,
  }),
  'exchange-random-inventory': variant('exchange-random-inventory', {
    inventoryId: id,
    left: target,
    right: target,
  }),
  'gain-score': targeted('gain-score', { amount: number }),
  'skip-turn': targeted('skip-turn', { count: positive }, []),
  'extra-turn': variant('extra-turn', { count: positive }, []),
  'add-status': targeted(
    'add-status',
    {
      status: id,
      turns: positive,
      scope: { enum: ['turn', 'global-turn', 'round', 'match', 'until-used'] },
      stack: boolean,
      data: record(ref('json')),
    },
    ['status'],
  ),
  'remove-status': targeted('remove-status', { status: id }),
  'roll-dice': variant('roll-dice', { diceId: id }, []),
  'reverse-turn-order': variant('reverse-turn-order'),
  'swap-positions': variant('swap-positions', {
    trackId: id,
    left: target,
    right: target,
  }),
  'complete-turn': variant('complete-turn'),
  'start-round': variant('start-round'),
  'end-round': variant('end-round'),
  'eliminate-player': targeted('eliminate-player', {}),
  custom: targeted('custom', { effectId: id, data: ref('json') }, ['effectId']),
} satisfies Record<GameEffectInstruction['kind'], AuthorSchema>;

export const EFFECT_JSON_SCHEMA_VERSION = 1;
export const effectJsonDefinitions: Readonly<Record<string, AuthorSchema>> = {
  target: { oneOf: Object.values(targets) },
  condition: { oneOf: Object.values(conditions) },
  effect: { oneOf: Object.values(instructions) },
  availability: {
    oneOf: [
      variant('cards', { handId: id, owner: target }),
      variant('resources', { owner: target, amount: positive }, ['owner']),
    ],
  },
  json: {
    oneOf: [
      { type: 'null' },
      boolean,
      number,
      { type: 'string' },
      array(ref('json')),
      record(ref('json')),
    ],
  },
};

/** Exportable standard JSON Schema, shared by editors and the runtime boundary. */
export const effectJsonSchema = freezeAuthorSchema({
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'urn:lila:effects:1',
  ...effects,
  $defs: effectJsonDefinitions,
});

export function assertEffectJson(
  value: unknown,
  path = 'effects',
  allowUndefinedOptionalFields = false,
): asserts value is readonly GameEffectInstruction[] {
  assertAuthorJson(value, path, allowUndefinedOptionalFields);
  validateAuthorSchema(
    value,
    effects,
    effectJsonDefinitions,
    path,
    allowUndefinedOptionalFields,
  );
}

export function assertConditionJson(
  value: unknown,
  path = 'condition',
): asserts value is EffectCondition {
  assertAuthorJson(value, path);
  validateAuthorSchema(value, ref('condition'), effectJsonDefinitions, path);
}

export function assertTargetJson(
  value: unknown,
  path = 'target',
): asserts value is EffectTarget {
  assertAuthorJson(value, path);
  validateAuthorSchema(value, target, effectJsonDefinitions, path);
}
