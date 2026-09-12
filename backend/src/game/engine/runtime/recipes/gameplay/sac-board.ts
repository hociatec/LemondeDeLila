import type {
  SacCard,
  SacMovement,
  SacTile,
  SacVariant,
} from '../../extensions/sac/program';
import { rejectRule } from '../../../../core/domain/errors/game-domain.errors';
import { drawAndResolve } from './card-dice.recipes';
import {
  SAC,
  sacBuildings,
  type SacContext,
  type SacManagement,
  type SacState,
  type createSacSupport,
} from './sac-support';

type Support = ReturnType<typeof createSacSupport>;
const MAX_CHAIN_DEPTH = 24;

export function createSacBoard(support: Support) {
  function rollPair(ctx: SacContext): [number, number] {
    const result = ctx.dice.roll('pair').values;
    return [result[0], result[1]];
  }
  function resolveJailTurn(state: SacState, playerId: number, ctx: SacContext) {
    const rules = support.current(ctx).rules;
    if (rules.jail.allowDoubleEscape) {
      const [first, second] = rollPair(ctx);
      const total = first + second;
      if (first === second) {
        ctx.resources.set(playerId, SAC.jailTurns, 0);
        ctx.turn.extra();
        moveForward(state, playerId, total, 0, ctx);
        ctx.turn.complete();
        return;
      }
    }
    const remaining = Math.max(
      0,
      ctx.resources.get(playerId, SAC.jailTurns) - 1,
    );
    ctx.resources.set(playerId, SAC.jailTurns, remaining);
    if (remaining === 0 && rules.jail.autoFine > 0)
      support.changeMoney(state, playerId, -rules.jail.autoFine, true, ctx);
    ctx.turn.clearExtra(playerId);
    ctx.turn.complete();
  }
  function moveForward(
    state: SacState,
    playerId: number,
    delta: number,
    depth: number,
    ctx: SacContext,
  ) {
    if (
      depth > MAX_CHAIN_DEPTH ||
      ctx.match.playerStatus(playerId) === 'eliminated'
    )
      return;
    const variant = support.current(ctx);
    const current = ctx.movement.position(SAC.track, playerId);
    const raw = current + delta;
    if (delta > 0 && raw >= variant.tiles.length) {
      const passages = Math.floor(raw / variant.tiles.length);
      support.changeMoney(
        state,
        playerId,
        variant.rules.passStartBonus * passages,
        false,
        ctx,
      );
    }
    support.moveTo(playerId, modulo(raw, variant.tiles.length), ctx);
    resolveTile(state, playerId, depth + 1, ctx);
  }
  function resolveTile(
    state: SacState,
    playerId: number,
    depth: number,
    ctx: SacContext,
  ) {
    const variant = support.current(ctx);
    ctx.movement.resolveLanding({
      trackId: SAC.track,
      playerId,
      tiles: variant.tiles,
      depth,
      maxDepth: MAX_CHAIN_DEPTH,
      blocked: () => ctx.match.playerStatus(playerId) === 'eliminated',
      onLand: ({ position: tileIndex, tile }) => {
        if (!tile) return;
        ctx.events.message('game.pawn.landed', { playerId, tileId: tileIndex });
        if (tile.type === 'go_to_jail')
          support.sendToJail(state, playerId, ctx);
        else if (tile.type === 'free')
          collectPot(state, playerId, variant, ctx);
        else if (tile.type === 'tax') payTax(state, playerId, tile, ctx);
        else if (tile.type === 'chance' || tile.type === 'community')
          drawCard(playerId, tile.type, ctx);
        else if (isOwnable(tile))
          resolveOwnable(state, playerId, tileIndex, tile, ctx);
      },
    });
  }
  function collectPot(
    state: SacState,
    playerId: number,
    variant: SacVariant,
    ctx: SacContext,
  ) {
    if (!variant.rules.potEnabled) return;
    const amount = ctx.counters.drain(SAC.pot);
    if (amount > 0) support.changeMoney(state, playerId, amount, false, ctx);
  }
  function payTax(
    state: SacState,
    playerId: number,
    tile: SacTile,
    ctx: SacContext,
  ) {
    const amount = tile.taxAmount ?? 0;
    if (amount > 0) support.changeMoney(state, playerId, -amount, true, ctx);
  }
  function resolveOwnable(
    state: SacState,
    playerId: number,
    tileIndex: number,
    tile: SacTile,
    ctx: SacContext,
  ) {
    const ownerId = ctx.ownership.ownerOf(SAC.properties, tile.id);
    if (ownerId == null) {
      const price = support.purchasePrice(support.current(ctx), tile);
      ctx.choice.one({
        id: 'sac.purchase',
        player: playerId,
        options: ctx.resources.has(playerId, SAC.money, price)
          ? ['buy', 'skip']
          : ['skip'],
        data: { flow: 'purchase', playerId, tileIndex },
        label: (choice) =>
          choice === 'buy' ? `Acheter pour ${price}` : 'Passer',
      });
      return;
    }
    if (ownerId === playerId || sacBuildings(state)[tileIndex]?.mortgaged)
      return;
    const rules = support.current(ctx).rules;
    if (
      rules.rentBlockedInJail &&
      ctx.resources.get(ownerId, SAC.jailTurns) > 0
    )
      return;
    const rent = support.rentFor(
      state,
      tileIndex,
      tile,
      ownerId,
      support.current(ctx),
      ctx.dice.last('pair')?.total ?? 0,
      ctx,
    );
    support.changeMoney(state, playerId, -rent, false, ctx);
    if (ctx.match.playerStatus(ownerId) === 'active')
      support.changeMoney(state, ownerId, rent, false, ctx);
    ctx.events.message('sac.rent.paid', {
      playerId,
      ownerId,
      amount: rent,
      tileId: tileIndex,
    });
  }
  function drawCard(
    playerId: number,
    deck: 'chance' | 'community',
    ctx: SacContext,
  ) {
    const deckId = `${deck}:${support.current(ctx).id}`;
    drawAndResolve<SacState, SacCard, boolean>(ctx, {
      deckId,
      playerId,
      resolve: (card) => {
        ctx.effects.schedule(...card.effects);
        return card.retained;
      },
      discard: ({ result: retained }) => !retained,
    });
  }
  function resolvePurchase(state: SacState, decision: string, ctx: SacContext) {
    const pending = ctx.choice.consumeContinuation<{
      flow: 'purchase';
      playerId: number;
      tileIndex: number;
    }>();
    if (pending?.flow !== 'purchase') rejectRule('Achat Sac à Malices absent');
    if (decision === 'buy')
      buyTile(state, pending.playerId, pending.tileIndex, ctx);
    else if (decision !== 'skip') rejectRule('Décision d’achat invalide');
    ctx.turn.complete();
  }
  function buyTile(
    state: SacState,
    playerId: number,
    tileIndex: number,
    ctx: SacContext,
  ) {
    const variant = support.current(ctx);
    const tile = variant.tiles[tileIndex];
    const price = support.purchasePrice(variant, tile);
    if (
      ctx.ownership.isOwned(SAC.properties, tile.id) ||
      price <= 0 ||
      !ctx.resources.has(playerId, SAC.money, price)
    )
      return;
    support.changeMoney(state, playerId, -price, false, ctx);
    ctx.ownership.claim(SAC.properties, tile.id, playerId);
    sacBuildings(state)[tileIndex] = {
      houses: 0,
      hotel: false,
      mortgaged: false,
    };
    ctx.events.message('sac.property.bought', {
      playerId,
      tileId: tileIndex,
      amount: price,
    });
  }
  function resolveManagement(
    state: SacState,
    tileIndex: number,
    ctx: SacContext,
  ) {
    const pending = ctx.choice.consumeContinuation<{
      flow: 'management';
      playerId: number;
      kind: SacManagement;
    }>();
    if (pending?.flow !== 'management')
      rejectRule('Gestion Sac à Malices absente');
    if (
      !support
        .managementOptions(state, pending.playerId, pending.kind, ctx)
        .includes(tileIndex)
    )
      rejectRule('Propriété Sac à Malices invalide');
    support.applyManagement(
      state,
      pending.playerId,
      pending.kind,
      tileIndex,
      ctx,
    );
  }
  function applyMovement(
    state: SacState,
    playerId: number,
    movement: SacMovement,
    ctx: SacContext,
  ) {
    if (movement.kind === 'delta') {
      moveForward(state, playerId, movement.delta, 0, ctx);
      return;
    }
    const target = movementTarget(playerId, movement, ctx);
    if (target == null) return;
    const current = ctx.movement.position(SAC.track, playerId);
    if (target < current || (movement.kind === 'start' && movement.collect))
      support.changeMoney(
        state,
        playerId,
        support.current(ctx).rules.passStartBonus,
        false,
        ctx,
      );
    support.moveTo(playerId, target, ctx);
    resolveTile(state, playerId, 1, ctx);
  }
  function movementTarget(
    playerId: number,
    movement: Exclude<SacMovement, { kind: 'delta' }>,
    ctx: SacContext,
  ) {
    const variant = support.current(ctx);
    const current = ctx.movement.position(SAC.track, playerId);
    if (movement.kind === 'last') return variant.tiles.length - 1;
    if (movement.kind === 'start') return 0;
    if (movement.kind === 'next-station')
      return nextType(variant, current, 'station', 1);
    if (movement.kind === 'next-community')
      return nextType(variant, current, 'community', 1);
    if (movement.kind === 'previous-chance')
      return nextType(variant, current, 'chance', -1);
    if (movement.kind === 'next-group')
      return nextGroup(variant, current, movement.groupId);
    if (movement.kind !== 'tile') return null;
    const index = variant.tiles.findIndex(
      (tile) => tile.id === movement.tileId,
    );
    return index >= 0 ? index : null;
  }
  return {
    rollPair,
    resolveJailTurn,
    moveForward,
    resolvePurchase,
    resolveManagement,
    applyMovement,
  };
}
function nextType(
  variant: SacVariant,
  current: number,
  type: SacTile['type'],
  direction: 1 | -1,
) {
  for (let distance = 1; distance < variant.tiles.length; distance += 1) {
    const index = modulo(current + distance * direction, variant.tiles.length);
    if (variant.tiles[index].type === type) return index;
  }
  return null;
}
function nextGroup(variant: SacVariant, current: number, groupId: string) {
  for (let distance = 1; distance < variant.tiles.length; distance += 1) {
    const index = modulo(current + distance, variant.tiles.length);
    if (variant.tiles[index].groupId === groupId) return index;
  }
  return null;
}
function modulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}
function isOwnable(tile: SacTile) {
  return ['property', 'station', 'utility'].includes(tile.type);
}
