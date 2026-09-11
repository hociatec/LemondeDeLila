import { gameInput, rejectContent } from '../../../engine/sdk/public-api';
import { parseSacCard } from './card-content';
import type { SacVariant } from './content-types';
import { assertSacReferences } from './content-reference-validation';

const money = gameInput.number({ integer: true, min: 0, max: 1000000000 });
const label = gameInput.string({ min: 1, max: 1000 });
const id = gameInput.string({ min: 1, max: 128 });
const propertyIds = gameInput.array(id, { max: 1000 });
const properties = gameInput.array(label, { max: 1000 });
const purchase = {
  purchasePrice: money,
  mortgage: money,
  unmortgageCost: money,
};
const card = { parse: parseSacCard, describe: () => ({ type: 'object' }) };
const variantSchema = gameInput.object({
  id: gameInput.enum([
    'classic',
    'gaia',
    'violette-boussole',
    'sabord-quai',
    'route-des-flandres',
    'cosmos-credit',
    'pintzel-couronnes',
  ]),
  label,
  tiles: gameInput.array(
    gameInput.object({
      n: gameInput.number({ integer: true, min: 1, max: 1000 }),
      id,
      title: label,
      description: gameInput.optional(gameInput.string({ max: 10000 })),
      type: gameInput.enum([
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
      ]),
      group: gameInput.optional(label),
      groupId: gameInput.optional(id),
      taxAmount: gameInput.optional(money),
    }),
    { min: 2, max: 1000 },
  ),
  chance: gameInput.array(card, { min: 1, max: 10000 }),
  community: gameInput.array(card, { min: 1, max: 10000 }),
  groups: gameInput.array(
    gameInput.object({
      id,
      color: label,
      properties,
      propertyIds,
      ...purchase,
      rents: gameInput.object({
        base: money,
        house1: money,
        house2: money,
        house3: money,
        house4: money,
        hotel: money,
      }),
      housePrice: money,
      hotelPrice: money,
      housePrices: gameInput.optional(
        gameInput.object({
          '1': gameInput.optional(money),
          '2': gameInput.optional(money),
          '3': gameInput.optional(money),
          '4': gameInput.optional(money),
        }),
      ),
    }),
    { max: 1000 },
  ),
  stations: gameInput.object({
    properties,
    propertyIds,
    ...purchase,
    rents: gameInput.object({ '1': money, '2': money, '3': money, '4': money }),
  }),
  utilities: gameInput.array(
    gameInput.object({
      tileId: id,
      name: label,
      ...purchase,
      multiplier1: money,
      multiplier2: money,
    }),
    { max: 1000 },
  ),
  rules: gameInput.object({
    startMoney: money,
    passStartBonus: money,
    potEnabled: gameInput.boolean(),
    rentBlockedInJail: gameInput.boolean(),
    jail: gameInput.object({
      tileId: id,
      maxTurns: gameInput.number({ integer: true, min: 1, max: 1000 }),
      autoFine: money,
      allowPayFine: gameInput.boolean(),
      allowDoubleEscape: gameInput.boolean(),
    }),
  }),
});
const contentSchema = gameInput.object({
  variants: gameInput.array(variantSchema, { min: 1, max: 7 }),
});

export function parseSacContent(value: unknown): { variants: SacVariant[] } {
  const parsed = contentSchema.parse(value);
  const cardIds = parsed.variants.flatMap((variant) =>
    [...variant.chance, ...variant.community].map((card) => card.id),
  );
  if (new Set(cardIds).size !== cardIds.length)
    rejectContent('Identifiants de cartes Sac dupliqués');
  if (
    new Set(parsed.variants.map((variant) => variant.id)).size !==
      parsed.variants.length ||
    !parsed.variants.some((variant) => variant.id === 'classic')
  )
    rejectContent('Variantes Sac à Malices invalides');
  for (const variant of parsed.variants) {
    assertSacReferences(variant);
    if (variant.tiles.some((tile, index) => tile.n !== index + 1))
      rejectContent('Cases Sac à Malices non consécutives');
    for (const tile of variant.tiles) {
      if (tile.type === 'tax' && tile.taxAmount === undefined)
        rejectContent('Montant de taxe manquant');
    }
  }
  return parsed;
}
