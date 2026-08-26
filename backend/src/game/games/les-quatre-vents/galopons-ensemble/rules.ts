import {
  rollDice,
  sequentialPawnSelection,
  setupPlayingPhases,
} from '../../../core/application/public-api';
import type {
  GameContext,
  PlayerMap,
} from '../../../core/application/public-api';
import {
  GALOPONS_TILES,
  type GaloponsCard,
  type GaloponsRegion,
} from './content';
import type { GaloponsState } from './state';

type RuleContext = GameContext<GaloponsState>;
export const GALOPONS_PHASES = setupPlayingPhases<GaloponsState>();
const TRACK = 'galopons';
const DECK = 'adventure';
const FINISH = GALOPONS_TILES.length - 1;
const APPLES_TO_WIN = 3;
const MAX_DEPTH = 12;
const APPLE = 'apple';
const RETURNING = 'galopons.returning';

export const roll = rollDice<GaloponsState>({
  documentation: 'Paie les dettes, lance le dé et résout la case équestre.',
  available: ({ ctx }) => GALOPONS_PHASES.is(ctx, 'playing'),
  execute: ({ state, playerId, total, ctx }) => {
    payIou(state, playerId, ctx);
    moveAndLand(state, playerId, total, 0, ctx);
    ctx.turn.complete({ waiting: ctx.choice.current() != null });
  },
});

export const GALOPONS_ACTIONS = { roll };

const pawnSelection = sequentialPawnSelection<GaloponsState>({
  setId: 'galopons',
  choiceId: 'galopons.pawn',
  complete: ({ ctx }) => {
    GALOPONS_PHASES.transition(ctx, 'playing');
    const starterId = ctx.round.starter();
    if (starterId != null) ctx.turn.to(starterId);
  },
});

export const requestPawn = pawnSelection.request;
export const resolvePawn = pawnSelection.resolve;

export function pairAdvance(
  state: GaloponsState,
  actorId: number,
  targetId: number,
  delta: number,
  ctx: RuleContext,
): void {
  moveAndLand(state, actorId, delta, 0, ctx);
  if (ctx.match.lifecycle() !== 'finished') {
    moveAndLand(state, targetId, delta, 0, ctx);
  }
}

export function moveAndLand(
  state: GaloponsState,
  playerId: number,
  delta: number,
  depth: number,
  ctx: RuleContext,
): void {
  if (depth > MAX_DEPTH || ctx.match.lifecycle() === 'finished') return;
  moveHorse(state, playerId, delta, ctx);
  resolveLanding(state, playerId, depth + 1, ctx);
}

function moveHorse(
  state: GaloponsState,
  playerId: number,
  delta: number,
  ctx: RuleContext,
): void {
  const current = position(playerId, ctx);
  const direction = movementDirection(playerId, ctx);
  const signed = delta < 0 ? -direction : direction;
  let target = current;
  let nextDirection = direction;
  for (let step = 0; step < Math.abs(Math.trunc(delta)); step += 1) {
    target += signed;
    if (target > FINISH) {
      target = FINISH - (target - FINISH);
      nextDirection = -1;
    } else if (target < 0) {
      target = -target;
      nextDirection = 1;
    }
  }
  if (direction === -1 && target === 0) nextDirection = 1;
  ctx.movement.moveTo(TRACK, playerId, target);
  if (nextDirection === -1) {
    ctx.status.add(playerId, RETURNING, { scope: 'until-used' });
  } else {
    ctx.status.remove(playerId, RETURNING);
  }
}

function resolveLanding(
  state: GaloponsState,
  playerId: number,
  depth: number,
  ctx: RuleContext,
): void {
  const current = position(playerId, ctx);
  const tile = GALOPONS_TILES[current];
  ctx.events.message('game.pawn.landed', { playerId, tileId: current });
  if (tile.type === 'finish') {
    const apples = ctx.resources.add(playerId, APPLE, 1);
    if (apples >= APPLES_TO_WIN) {
      ctx.match.finish({
        winners: [playerId],
        reason: 'three-apples-at-finish',
      });
    } else ctx.status.add(playerId, RETURNING, { scope: 'until-used' });
    return;
  }
  const occupant = ctx.players
    .all()
    .find(
      (player) =>
        player.id !== playerId && position(player.id, ctx) === current,
    );
  if (occupant) moveHorse(state, occupant.id, -5, ctx);
  if (tile.type === 'bonus') ctx.resources.add(playerId, APPLE, tile.apples);
  else if (tile.type === 'skip') ctx.turn.skip(playerId, tile.skipTurns);
  else if (tile.type === 'card') drawAndApply(state, playerId, depth, ctx);
}

function drawAndApply(
  state: GaloponsState,
  playerId: number,
  depth: number,
  ctx: RuleContext,
): void {
  if (depth > MAX_DEPTH || ctx.choice.current() != null) return;
  ctx.cards.drawThenResolve<GaloponsCard, void>(
    DECK,
    (card) => {
      ctx.events.message('game.card.drawn', {
        playerId,
        deckId: DECK,
        cardId: card.id,
      });
      ctx.effects.schedule(...card.effects);
    },
    {},
  );
}

export function moveToNextRegion(
  state: GaloponsState,
  playerId: number,
  region: GaloponsRegion,
  depth: number,
  ctx: RuleContext,
): void {
  const current = position(playerId, ctx);
  const direction = movementDirection(playerId, ctx);
  const target = GALOPONS_TILES.findIndex(
    (tile, index) =>
      tile.region === region &&
      (direction === 1 ? index > current : index < current),
  );
  if (target >= 0) {
    ctx.movement.moveTo(TRACK, playerId, target);
    resolveLanding(state, playerId, depth + 1, ctx);
  }
}

export function giveAppleWithIou(
  actorId: number,
  targetId: number,
  ctx: RuleContext,
): void {
  if (!ctx.resources.has(actorId, APPLE, 1)) return;
  ctx.resources.transfer(actorId, targetId, APPLE, 1);
  ctx.resources.add(targetId, iouResource(actorId), 1);
}

export function helpAdvanceForApple(
  state: GaloponsState,
  actorId: number,
  targetId: number,
  delta: number,
  ctx: RuleContext,
): void {
  moveAndLand(state, targetId, delta, 0, ctx);
  if (ctx.resources.has(targetId, APPLE, 1)) {
    ctx.resources.transfer(targetId, actorId, APPLE, 1);
  }
}

function payIou(
  state: GaloponsState,
  playerId: number,
  ctx: RuleContext,
): void {
  const creditor = ctx.players
    .all()
    .map((player) => player.id)
    .find((id) => ctx.resources.get(playerId, iouResource(id)) > 0);
  if (creditor == null || !ctx.resources.has(playerId, APPLE, 1)) return;
  ctx.resources.transfer(playerId, creditor, APPLE, 1);
  ctx.resources.remove(playerId, iouResource(creditor), 1);
}

export function galoponsIous(
  ctx: RuleContext,
): PlayerMap<PlayerMap<number>> {
  const playerIds = ctx.players.all().map((player) => player.id);
  return Object.fromEntries(
    playerIds.map((debtorId) => [
      debtorId,
      Object.fromEntries(
        playerIds.flatMap((creditorId) => {
          const count = ctx.resources.get(debtorId, iouResource(creditorId));
          return count > 0 ? [[creditorId, count]] : [];
        }),
      ),
    ]),
  );
}

function iouResource(creditorId: number): string {
  return `galopons.iou.${creditorId}`;
}

function movementDirection(playerId: number, ctx: RuleContext): 1 | -1 {
  return ctx.status.has(playerId, RETURNING) ? -1 : 1;
}

function position(playerId: number, ctx: RuleContext): number {
  return ctx.movement.position(TRACK, playerId);
}
