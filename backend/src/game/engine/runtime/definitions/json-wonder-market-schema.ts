import type { WonderMarketProgram } from '../contracts/wonder-market-program';
import type { GameComponentDefinition } from './component-kit';
import {
  authorArray as array,
  authorId as id,
  authorObject as object,
} from '../contracts/json-author-schema';
import { GameConfigurationError } from '../../../core/domain/errors/game-domain.errors';

const count = { type: 'integer', minimum: 0, maximum: 1000000 } as const;
export const jsonWonderMarketSchema = object({
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

export function assertWonderMarketReferences(
  program: WonderMarketProgram,
  components: readonly GameComponentDefinition[],
  resources: ReadonlySet<string>,
  counters: ReadonlySet<string>,
): void {
  const fail = (reason: string): never => {
    throw new GameConfigurationError(`Wonder market: ${reason}`);
  };
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
  const inventoryItems = inventory?.items ?? fail('unknown inventory catalog');
  if (
    market?.component !== 'economy.market' ||
    market.inventory !== program.inventoryId ||
    market.currency !== program.currency
  )
    fail('unknown market or mismatched inventory/currency');
  if (!resources.has(program.currency)) fail('unknown currency');
  if (!counters.has(program.turnsCounterId)) fail('unknown turns counter');
  if (new Set(program.goods).size !== program.goods.length)
    fail('duplicate good');
  for (const good of program.goods)
    if (!inventoryItems.includes(good)) fail(`unknown good ${good}`);
}
