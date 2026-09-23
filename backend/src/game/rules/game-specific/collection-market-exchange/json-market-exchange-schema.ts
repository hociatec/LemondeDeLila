import {
  authoringFailure,
  assertUniqueAuthorValues,
} from '../../../engine/runtime/contracts/authoring-diagnostics';
import type { MarketExchangeProgram } from './program';
import type { GameComponentDefinition } from '../../../engine/runtime/definitions/component-kit';
import {
  authorArray as array,
  authorId as id,
  authorObject as object,
} from '../../../engine/runtime/contracts/json-author-schema';

const count = { type: 'integer', minimum: 0, maximum: 1000000 } as const;
export const jsonMarketExchangeSchema = object({
  marketId: id,
  inventoryId: id,
  currency: id,
  goods: array(id, 1),
  turnsCounterId: id,
  maxRounds: { type: 'integer', minimum: 1, maximum: 10000 },
  rumorCost: count,
  protectCost: count,
  eventNamespace: id,
});

export function assertMarketExchangeReferences(
  program: MarketExchangeProgram,
  components: readonly GameComponentDefinition[],
  resources: ReadonlySet<string>,
  counters: ReadonlySet<string>,
): void {
  const fail = authoringFailure(
    'game.json.marketExchange',
    program,
    'Market exchange: ',
  );
  const inventory = components.find(
    (
      component,
    ): component is Extract<
      GameComponentDefinition,
      { component: 'inventory.set' }
    > =>
      component.component === 'inventory.set' &&
      component.id === program.inventoryId,
  );
  const market = components.find(
    (component) =>
      component.component === 'economy.market' &&
      component.id === program.marketId,
  );
  const inventoryItems =
    inventory?.items ?? fail('inventoryId', 'unknown inventory catalog');
  if (
    market?.component !== 'economy.market' ||
    market.inventory !== program.inventoryId ||
    market.currency !== program.currency
  )
    fail('marketId', 'unknown market or mismatched inventory/currency');
  if (!resources.has(program.currency)) fail('currency', 'unknown currency');
  if (!counters.has(program.turnsCounterId))
    fail('turnsCounterId', 'unknown turns counter');
  assertUniqueAuthorValues(program.goods, (i) => `goods[${i}]`, fail);
  for (const [i, good] of program.goods.entries())
    if (!inventoryItems.includes(good))
      fail(`goods[${i}]`, `unknown good ${good}`);
}
