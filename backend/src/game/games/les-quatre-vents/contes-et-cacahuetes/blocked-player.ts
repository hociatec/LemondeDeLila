import type { GameContext } from '../../../engine/sdk/public-api';
import { CONTES_STATUSES } from './constants';
import type { ContesState } from './types';
type RuleContext = GameContext<ContesState>;

export function blockedPosition(
  ctx: RuleContext,
  playerId: number,
): number | null {
  const value = ctx.status.get(playerId, CONTES_STATUSES.blocked)?.data
    .position;
  return typeof value === 'number' ? value : null;
}
