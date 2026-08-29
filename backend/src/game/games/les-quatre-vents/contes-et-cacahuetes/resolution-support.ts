import { rejectRule } from '../../../engine/sdk/public-api';
import type { GameContext } from '../../../engine/sdk/public-api';
import { CONTES_DECKS, CONTES_TILES } from './content';
import { CONTES_STATUSES } from './constants';
import type { ContesPendingEffect, ContesState } from './state';

type RuleContext = GameContext<ContesState>;
const TRACK = 'story-road';

export function requirePending<TKind extends ContesPendingEffect['kind']>(
  ctx: RuleContext,
  kind: TKind,
  actorId: number,
): Extract<ContesPendingEffect, { kind: TKind }> {
  const pending = ctx.choice.consumeContinuation<ContesPendingEffect>();
  if (!pending || !hasKind(pending, kind) || pending.actorId !== actorId)
    rejectRule(`Choix Contes ${kind} absent`);
  return pending;
}

function hasKind<TKind extends ContesPendingEffect['kind']>(
  pending: ContesPendingEffect,
  kind: TKind,
): pending is Extract<ContesPendingEffect, { kind: TKind }> {
  return pending.kind === kind;
}

export function rollDie(ctx: RuleContext): number {
  return ctx.dice.roll('main').total;
}

export function position(playerId: number, ctx: RuleContext): number {
  return ctx.movement.position(TRACK, playerId);
}

export function moveTo(
  playerId: number,
  target: number,
  ctx: RuleContext,
): void {
  ctx.movement.moveTo(TRACK, playerId, target);
}

export function blockedPosition(
  ctx: RuleContext,
  playerId: number,
): number | null {
  const value = ctx.status.get(playerId, CONTES_STATUSES.blocked)?.data
    .position;
  return typeof value === 'number' ? value : null;
}

export function addUntilUsedStatus(
  playerId: number,
  statusId: string,
  ctx: RuleContext,
): void {
  ctx.status.add(playerId, statusId, { scope: 'until-used' });
}

export const CONTES_CONTENT_COUNTS = {
  tiles: CONTES_TILES.length,
  cards: Object.values(CONTES_DECKS).reduce(
    (total, deck) => total + deck.length,
    0,
  ),
};
