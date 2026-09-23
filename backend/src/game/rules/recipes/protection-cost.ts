import type { GameContext } from '../../engine/sdk/public-api';

type Context = {
  resources: Pick<GameContext<object>['resources'], 'has' | 'remove'>;
  status: Pick<GameContext<object>['status'], 'consume'>;
};
export type ProtectionCost =
  { status: string } | { resource: string; amount: number };

/** Consume only the first affordable protection; callers own the consequences. */
export function consumeFirstProtection(
  ctx: Context,
  playerId: number,
  costs: readonly ProtectionCost[],
): number | undefined {
  for (const [index, cost] of costs.entries()) {
    if ('status' in cost) {
      if (ctx.status.consume(playerId, cost.status)) return index;
    } else if (ctx.resources.has(playerId, cost.resource, cost.amount)) {
      ctx.resources.remove(playerId, cost.resource, cost.amount);
      return index;
    }
  }
  return undefined;
}
