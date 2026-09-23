import { assertUniqueAuthorIds } from '../../../engine/runtime/contracts/authoring-diagnostics';
import {
  authoringFailure,
  assertUniqueAuthorValues,
  type AuthoringFailure,
} from '../../../engine/runtime/contracts/authoring-diagnostics';
import { isRecord } from '../../../engine/runtime/content/content-guards';
import type {
  PropertyEconomyMovement,
  PropertyEconomyProgram,
  PropertyEconomyVariant,
} from './program';
import { effectJsonSchema } from '../../../engine/runtime/contracts/effect-json-schema';
import {
  type AuthorSchema,
  authorId as id,
  authorObject as object,
} from '../../../engine/runtime/contracts/json-author-schema';

const money: AuthorSchema = {
  type: 'integer',
  minimum: 0,
  maximum: 1000000000,
};
const text: AuthorSchema = { type: 'string', minLength: 1, maxLength: 10000 };
const boundedArray = (
  items: AuthorSchema,
  minItems: number,
  maxItems: number,
): AuthorSchema => ({ type: 'array', items, minItems, maxItems });
const ids = boundedArray(id, 0, 1000);
const texts = boundedArray(text, 0, 1000);
const purchase = {
  purchasePrice: money,
  mortgage: money,
  unmortgageCost: money,
};
const rents = object({
  base: money,
  house1: money,
  house2: money,
  house3: money,
  house4: money,
  hotel: money,
});
const levelRents = object({
  '1': money,
  '2': money,
  '3': money,
  '4': money,
});
const card = object({
  id,
  text,
  effects: effectJsonSchema,
  retained: { type: 'boolean' },
});
const tile = object(
  {
    n: { type: 'integer', minimum: 1, maximum: 1000 },
    id,
    title: text,
    description: { type: 'string', maxLength: 10000 },
    type: {
      enum: [
        'start',
        'property',
        'station',
        'utility',
        'chance',
        'community',
        'tax',
        'jail',
        'go_to_jail',
        'free',
        'neutral',
      ],
    },
    group: text,
    groupId: id,
    taxAmount: money,
  },
  ['n', 'id', 'title', 'type'],
);
const group = object(
  {
    id,
    color: text,
    properties: texts,
    propertyIds: ids,
    ...purchase,
    rents,
    housePrice: money,
    hotelPrice: money,
    housePrices: object({ '1': money, '2': money, '3': money, '4': money }, []),
  },
  [
    'id',
    'color',
    'properties',
    'propertyIds',
    'purchasePrice',
    'mortgage',
    'unmortgageCost',
    'rents',
    'housePrice',
    'hotelPrice',
  ],
);
const variant = object({
  id,
  label: text,
  tiles: boundedArray(tile, 2, 1000),
  chance: boundedArray(card, 1, 10000),
  community: boundedArray(card, 1, 10000),
  groups: boundedArray(group, 0, 1000),
  stations: object({
    properties: texts,
    propertyIds: ids,
    ...purchase,
    rents: levelRents,
  }),
  utilities: boundedArray(
    object({
      tileId: id,
      name: text,
      ...purchase,
      multiplier1: money,
      multiplier2: money,
    }),
    0,
    1000,
  ),
  rules: object({
    startMoney: money,
    passStartBonus: money,
    potEnabled: { type: 'boolean' },
    rentBlockedInJail: { type: 'boolean' },
    jail: object({
      tileId: id,
      maxTurns: { type: 'integer', minimum: 1, maximum: 1000 },
      autoFine: money,
      allowPayFine: { type: 'boolean' },
      allowDoubleEscape: { type: 'boolean' },
    }),
  }),
});

export const jsonPropertyEconomySchema: AuthorSchema = object(
  {
    defaultVariantId: id,
    variants: boundedArray(variant, 1, 1000),
  },
  ['variants'],
);

export function assertPropertyEconomyReferences(
  program: PropertyEconomyProgram,
): void {
  const fail = authoringFailure('game.json.propertyEconomy', program);
  assertUniqueAuthorIds(program.variants, 'variants', fail);
  if (
    program.defaultVariantId != null &&
    !program.variants.some((v) => v.id === program.defaultVariantId)
  )
    fail('defaultVariantId', 'unknown variant');
  const cardIds = new Set<string>();
  for (const [index, variant] of program.variants.entries()) {
    const prefix = `variants[${index}]`;
    const local: AuthoringFailure = (field, reason) =>
      fail(`${prefix}.${field}`, reason);
    assertVariant(variant, local);
    for (const deck of ['chance', 'community'] as const)
      for (const [cardIndex, card] of variant[deck].entries()) {
        const cardPath = `${deck}[${cardIndex}]`;
        if (cardIds.has(card.id)) local(`${cardPath}.id`, 'duplicate card ID');
        cardIds.add(card.id);
        assertCardMovements(card.effects, variant, (field, reason) =>
          local(`${cardPath}.effects${field}`, reason),
        );
      }
  }
}

function assertVariant(
  variant: PropertyEconomyVariant,
  fail: AuthoringFailure,
): void {
  const tiles = new Map(variant.tiles.map((tile) => [tile.id, tile]));
  for (const collection of ['tiles', 'groups'] as const)
    assertUniqueAuthorValues(
      variant[collection].map((item) => item.id),
      (i) => `${collection}[${i}].id`,
      fail,
    );
  if (variant.tiles[0]?.type !== 'start')
    fail('tiles[0].type', 'start tile required');
  if (tiles.get(variant.rules.jail.tileId)?.type !== 'jail')
    fail('rules.jail.tileId', 'jail tile required');
  for (const [i, tile] of variant.tiles.entries()) {
    if (tile.n !== i + 1) fail(`tiles[${i}].n`, 'non-consecutive tiles');
    if (tile.type === 'tax' && tile.taxAmount === undefined)
      fail(`tiles[${i}].taxAmount`, 'tax amount missing');
  }
  assertGroups(variant, fail);
  const stations = variant.stations.propertyIds;
  assertUniqueAuthorValues(stations, (i) => `stations.propertyIds[${i}]`, fail);
  for (const [i, tileId] of stations.entries())
    if (tiles.get(tileId)?.type !== 'station')
      fail(`stations.propertyIds[${i}]`, 'station tile required');
  if (
    stations.length !==
    variant.tiles.filter((tile) => tile.type === 'station').length
  )
    fail('stations.propertyIds', 'every station tile must be listed');
  const utilities = variant.utilities.map((utility) => utility.tileId);
  assertUniqueAuthorValues(utilities, (i) => `utilities[${i}].tileId`, fail);
  for (const [i, tileId] of utilities.entries())
    if (tiles.get(tileId)?.type !== 'utility')
      fail(`utilities[${i}].tileId`, 'utility tile required');
  if (
    utilities.length !==
    variant.tiles.filter((tile) => tile.type === 'utility').length
  )
    fail('utilities', 'every utility tile must be listed');
}

function assertGroups(
  variant: PropertyEconomyVariant,
  fail: AuthoringFailure,
): void {
  const tiles = new Map(variant.tiles.map((tile) => [tile.id, tile]));
  const groups = new Set(variant.groups.map((group) => group.id));
  const grouped = new Set<string>();
  for (const [i, group] of variant.groups.entries()) {
    if (!group.propertyIds.length)
      fail(`groups[${i}].propertyIds`, 'empty group');
    for (const [j, tileId] of group.propertyIds.entries()) {
      const tile = tiles.get(tileId);
      if (
        !tile ||
        tile.type !== 'property' ||
        tile.groupId !== group.id ||
        grouped.has(tileId)
      )
        fail(`groups[${i}].propertyIds[${j}]`, 'invalid group property');
      grouped.add(tileId);
    }
  }
  for (const [i, tile] of variant.tiles.entries()) {
    if (
      tile.type === 'property' &&
      (!tile.groupId || !groups.has(tile.groupId))
    )
      fail(`tiles[${i}].groupId`, 'property without group');
    if (tile.type === 'property' && !grouped.has(tile.id))
      fail(`tiles[${i}].id`, 'property not listed in its group');
    if (tile.type !== 'property' && tile.groupId !== undefined)
      fail(`tiles[${i}].groupId`, 'group on non-property tile');
  }
}

function assertCardMovements(
  effects: PropertyEconomyVariant['chance'][number]['effects'],
  variant: PropertyEconomyVariant,
  fail: AuthoringFailure,
): void {
  for (const [i, effect] of effects.entries()) {
    if (
      effect.kind !== 'custom' ||
      effect.effectId !== 'board-property-economy.movement'
    )
      continue;
    const path = `[${i}].data.movement`;
    if (!isRecord(effect.data) || !isRecord(effect.data.movement))
      fail(path, 'invalid movement');
    assertMovement(
      effect.data.movement as PropertyEconomyMovement,
      variant,
      (field, reason) => fail(`${path}.${field}`, reason),
    );
  }
}

function assertMovement(
  movement: PropertyEconomyMovement,
  variant: PropertyEconomyVariant,
  fail: AuthoringFailure,
): void {
  if (
    movement.kind === 'tile' &&
    !variant.tiles.some((tile) => tile.id === movement.tileId)
  )
    fail('tileId', 'unknown destination');
  if (
    movement.kind === 'next-group' &&
    !variant.groups.some((group) => group.id === movement.groupId)
  )
    fail('groupId', 'unknown destination group');
  for (const [kind, tileType] of [
    ['next-station', 'station'],
    ['next-community', 'community'],
    ['previous-chance', 'chance'],
  ] as const)
    if (
      movement.kind === kind &&
      !variant.tiles.some((tile) => tile.type === tileType)
    )
      fail('kind', `no ${tileType} tile`);
}
