import type { GameContext } from '../../../engine/sdk/public-api';
import { CONTES_RESOURCES, CONTES_STATUSES } from './constants';
import type { ContesState } from './state';

type RuleContext = GameContext<ContesState>;

export function listTokens(playerId: number, ctx: RuleContext): string[] {
  const tokens: string[] = [];
  if (ctx.resources.has(playerId, CONTES_RESOURCES.reroll, 1)) {
    tokens.push('parchemin');
  }
  if (ctx.resources.has(playerId, CONTES_RESOURCES.shield, 1)) {
    tokens.push('amulette');
  }
  if (ctx.status.has(playerId, CONTES_STATUSES.cape)) tokens.push('cape');
  if (ctx.status.has(playerId, CONTES_STATUSES.keyOfGold)) {
    tokens.push('cle-or');
  }
  if (ctx.status.has(playerId, CONTES_STATUSES.replaceOne)) {
    tokens.push('feuille');
  }
  if (ctx.status.has(playerId, CONTES_STATUSES.reverseNextTurn)) {
    tokens.push('livre-envers');
  }
  if (ctx.status.has(playerId, CONTES_STATUSES.protectNextMalus)) {
    tokens.push('dragon-papier');
  }
  return tokens;
}

export function transferToken(
  fromId: number,
  toId: number,
  token: string,
  ctx: RuleContext,
): void {
  if (token === 'parchemin') {
    ctx.resources.transfer(fromId, toId, CONTES_RESOURCES.reroll, 1);
    return;
  }
  if (token === 'amulette') {
    ctx.resources.transfer(fromId, toId, CONTES_RESOURCES.shield, 1);
    return;
  }
  const statusId =
    token === 'cape'
      ? CONTES_STATUSES.cape
      : token === 'cle-or'
        ? CONTES_STATUSES.keyOfGold
        : token === 'feuille'
          ? CONTES_STATUSES.replaceOne
          : token === 'livre-envers'
            ? CONTES_STATUSES.reverseNextTurn
            : CONTES_STATUSES.protectNextMalus;
  ctx.status.remove(fromId, statusId);
  ctx.status.add(toId, statusId, { scope: 'until-used' });
}
