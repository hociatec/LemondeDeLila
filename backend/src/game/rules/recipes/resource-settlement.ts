import type { GameContext } from '../../engine/sdk/public-api';

type Resources = Pick<GameContext<object>['resources'], 'add' | 'set'>;

/** Balance arithmetic is independent of elimination, ownership and victory. */
export function settleResourceDelta(
  resources: Resources,
  playerId: number,
  resource: string,
  delta: number,
  options: {
    minimum: number;
    afterChange?: () => void;
    onShortfall: (shortfall: number) => void;
  },
): void {
  const balance = resources.add(playerId, resource, delta);
  options.afterChange?.();
  if (balance >= options.minimum) return;
  resources.set(playerId, resource, options.minimum);
  options.onShortfall(options.minimum - balance);
}
