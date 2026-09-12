import { GameConfigurationError } from '../../../core/domain/errors/game-domain.errors';
import type {
  SacMovement,
  SacProgram,
  SacVariant,
} from '../contracts/sac-program';
import { effectJsonSchema } from '../contracts/effect-json-schema';
import { isRecord } from '../content/content-guards';
import {
  type AuthorSchema,
  authorId as id,
  authorObject as object,
} from '../contracts/json-author-schema';

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
  id: {
    enum: [
      'classic',
      'gaia',
      'violette-boussole',
      'sabord-quai',
      'route-des-flandres',
      'cosmos-credit',
      'pintzel-couronnes',
    ],
  },
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

export const jsonSacSchema: AuthorSchema = object({
  variants: boundedArray(variant, 1, 7),
});

export function assertSacReferences(program: SacProgram): void {
  const fail = (reason: string): never => {
    throw new GameConfigurationError('Sac à Malices: ' + reason);
  };
  if (
    new Set(program.variants.map((candidate) => candidate.id)).size !==
      program.variants.length ||
    !program.variants.some((candidate) => candidate.id === 'classic')
  )
    fail('invalid variants');
  const cardIds = program.variants.flatMap((candidate) =>
    [...candidate.chance, ...candidate.community].map((card) => card.id),
  );
  if (new Set(cardIds).size !== cardIds.length) fail('duplicate card IDs');
  for (const candidate of program.variants) assertVariant(candidate, fail);
}

function assertVariant(variant: SacVariant, fail: (reason: string) => never) {
  const tiles = new Map(variant.tiles.map((tile) => [tile.id, tile]));
  const groups = new Map(variant.groups.map((group) => [group.id, group]));
  if (
    tiles.size !== variant.tiles.length ||
    groups.size !== variant.groups.length
  )
    fail(variant.id + ': duplicate identifier');
  if (
    variant.tiles[0]?.type !== 'start' ||
    tiles.get(variant.rules.jail.tileId)?.type !== 'jail'
  )
    fail(variant.id + ': invalid start or jail');
  if (variant.tiles.some((tile, index) => tile.n !== index + 1))
    fail(variant.id + ': non-consecutive tiles');
  if (
    variant.tiles.some(
      (tile) => tile.type === 'tax' && tile.taxAmount === undefined,
    )
  )
    fail(variant.id + ': tax amount missing');
  const grouped = new Set<string>();
  for (const group of variant.groups) {
    if (!group.propertyIds.length) fail(variant.id + ': empty group');
    for (const tileId of group.propertyIds) {
      const current = tiles.get(tileId);
      if (
        !current ||
        current.type !== 'property' ||
        current.groupId !== group.id ||
        grouped.has(tileId)
      )
        fail(variant.id + ': invalid group property');
      grouped.add(tileId);
    }
  }
  for (const current of variant.tiles) {
    if (
      current.type === 'property' &&
      (!current.groupId ||
        !groups.has(current.groupId) ||
        !grouped.has(current.id))
    )
      fail(variant.id + ': property without group');
    if (current.type !== 'property' && current.groupId !== undefined)
      fail(variant.id + ': group on non-property tile');
  }
  const stations = new Set(variant.stations.propertyIds);
  if (
    stations.size !== variant.stations.propertyIds.length ||
    stations.size !==
      variant.tiles.filter((current) => current.type === 'station').length ||
    [...stations].some((tileId) => tiles.get(tileId)?.type !== 'station')
  )
    fail(variant.id + ': invalid stations');
  const utilities = new Set(variant.utilities.map((utility) => utility.tileId));
  if (
    utilities.size !== variant.utilities.length ||
    utilities.size !==
      variant.tiles.filter((current) => current.type === 'utility').length ||
    [...utilities].some((tileId) => tiles.get(tileId)?.type !== 'utility')
  )
    fail(variant.id + ': invalid utilities');
  for (const current of [...variant.chance, ...variant.community])
    for (const effect of current.effects) {
      if (effect.kind !== 'custom' || effect.effectId !== 'sac.movement')
        continue;
      if (!isRecord(effect.data) || !isRecord(effect.data.movement))
        fail(variant.id + ': invalid movement');
      assertMovement(effect.data.movement as SacMovement, variant, fail);
    }
}

function assertMovement(
  movement: SacMovement,
  variant: SacVariant,
  fail: (reason: string) => never,
) {
  if (
    movement.kind === 'tile' &&
    !variant.tiles.some((tile) => tile.id === movement.tileId)
  )
    fail(variant.id + ': unknown destination');
  if (
    movement.kind === 'next-group' &&
    !variant.groups.some((group) => group.id === movement.groupId)
  )
    fail(variant.id + ': unknown destination group');
  if (
    movement.kind === 'next-station' &&
    !variant.tiles.some((tile) => tile.type === 'station')
  )
    fail(variant.id + ': no station');
  if (
    movement.kind === 'next-community' &&
    !variant.tiles.some((tile) => tile.type === 'community')
  )
    fail(variant.id + ': no community tile');
  if (
    movement.kind === 'previous-chance' &&
    !variant.tiles.some((tile) => tile.type === 'chance')
  )
    fail(variant.id + ': no chance tile');
}
