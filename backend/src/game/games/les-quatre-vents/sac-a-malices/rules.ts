import { drawAndResolve, rejectRule } from '../../../engine/sdk/public-api';
import type { GameContext } from '../../../engine/sdk/public-api';
import type { SacCard, SacMovement, SacTile } from './content';
import {
  buildCost,
  buildingAt,
  changeMoney,
  collectPot,
  currentSacVariant,
  findTile,
  groupFor,
  houseCost,
  isOwnable,
  modulo,
  mortgageValue,
  moveTo,
  nextGroupTile,
  nextTileOfType,
  ownsGroup,
  payTax,
  position,
  purchasePrice,
  rentFor,
  SAC_JAIL_TURNS,
  sendToJail,
  unmortgageCost,
} from './economy';
import type { SacManagementKind, SacState } from './state';

type RuleContext = GameContext<SacState>;
const MAX_CHAIN_DEPTH = 24;
const PROPERTIES = 'properties';
const TRACK = 'city';

export function resolvePurchase(
  state: SacState,
  decision: string,
  ctx: RuleContext,
): void {
  const pending = ctx.choice.consumeContinuation<{
    flow: 'purchase';
    playerId: number;
    tileIndex: number;
  }>();
  if (pending?.flow !== 'purchase') rejectRule('Achat Sac à Malices absent');
  if (decision === 'buy')
    buyTile(state, pending.playerId, pending.tileIndex, ctx);
  else if (decision !== 'skip') rejectRule('Décision d’achat invalide');
  ctx.turn.complete({ waiting: ctx.choice.current() != null });
}

export function resolveManagement(
  state: SacState,
  tileIndex: number,
  ctx: RuleContext,
): void {
  const pending = ctx.choice.consumeContinuation<{
    flow: 'management';
    playerId: number;
    kind: SacManagementKind;
  }>();
  if (pending?.flow !== 'management')
    rejectRule('Gestion Sac à Malices absente');
  if (
    !managementOptions(state, pending.playerId, pending.kind, ctx).includes(
      tileIndex,
    )
  )
    rejectRule('Propriété Sac à Malices invalide');
  applyManagement(state, pending.playerId, pending.kind, tileIndex, ctx);
}

export function resolveJailTurn(
  state: SacState,
  playerId: number,
  ctx: RuleContext,
): void {
  const rules = currentSacVariant(ctx).rules;
  if (rules.jail.allowDoubleEscape) {
    const [first, second] = rollPair(ctx);
    const total = first + second;
    if (first === second) {
      ctx.resources.set(playerId, SAC_JAIL_TURNS, 0);
      ctx.turn.extra();
      moveForward(state, playerId, total, 0, ctx);
      ctx.turn.complete({ waiting: ctx.choice.current() != null });
      return;
    }
  }
  const jailTurns = Math.max(
    0,
    ctx.resources.get(playerId, SAC_JAIL_TURNS) - 1,
  );
  ctx.resources.set(playerId, SAC_JAIL_TURNS, jailTurns);
  if (jailTurns === 0 && rules.jail.autoFine > 0)
    changeMoney(state, playerId, -rules.jail.autoFine, true, ctx);
  ctx.turn.clearExtra(playerId);
  ctx.turn.complete({ waiting: ctx.choice.current() != null });
}

export function rollPair(ctx: RuleContext): [number, number] {
  const result = ctx.dice.roll('pair').values;
  return [result[0], result[1]];
}

export function moveForward(
  state: SacState,
  playerId: number,
  delta: number,
  depth: number,
  ctx: RuleContext,
): void {
  if (
    depth > MAX_CHAIN_DEPTH ||
    ctx.match.playerStatus(playerId) === 'eliminated'
  )
    return;
  const variant = currentSacVariant(ctx);
  const current = position(playerId, ctx);
  const raw = current + delta;
  if (delta > 0 && raw >= variant.tiles.length) {
    const passages = Math.floor(raw / variant.tiles.length);
    changeMoney(
      state,
      playerId,
      variant.rules.passStartBonus * passages,
      false,
      ctx,
    );
  }
  moveTo(playerId, modulo(raw, variant.tiles.length), ctx);
  resolveSacTile(state, playerId, depth + 1, ctx);
}

function resolveSacTile(
  state: SacState,
  playerId: number,
  depth: number,
  ctx: RuleContext,
): void {
  const variant = currentSacVariant(ctx);
  ctx.movement.resolveLanding({
    trackId: TRACK,
    playerId,
    tiles: variant.tiles,
    depth,
    maxDepth: MAX_CHAIN_DEPTH,
    blocked: () => ctx.match.playerStatus(playerId) === 'eliminated',
    onLand: ({ position: tileIndex, tile }) => {
      if (!tile) return;
      ctx.events.message('game.pawn.landed', { playerId, tileId: tileIndex });
      if (tile.type === 'go_to_jail') sendToJail(state, playerId, ctx);
      else if (tile.type === 'free') collectPot(state, playerId, variant, ctx);
      else if (tile.type === 'tax') payTax(state, playerId, tile, ctx);
      else if (tile.type === 'chance' || tile.type === 'community') {
        drawSacCard(playerId, tile.type, ctx);
      } else if (isOwnable(tile)) {
        resolveOwnable(state, playerId, tileIndex, tile, ctx);
      }
    },
  });
}

function resolveOwnable(
  state: SacState,
  playerId: number,
  tileIndex: number,
  tile: SacTile,
  ctx: RuleContext,
): void {
  const ownerId = ctx.ownership.ownerOf(PROPERTIES, String(tileIndex));
  if (ownerId == null) {
    const price = purchasePrice(currentSacVariant(ctx), tile);
    ctx.choice.one({
      id: 'sac.purchase',
      player: playerId,
      options: ctx.resources.has(playerId, 'money', price)
        ? ['buy', 'skip']
        : ['skip'],
      data: { flow: 'purchase', playerId, tileIndex },
      label: (choice) =>
        choice === 'buy' ? `Acheter pour ${price}` : 'Passer',
    });
    return;
  }
  if (ownerId === playerId || state.buildings[tileIndex]?.mortgaged) return;
  const rules = currentSacVariant(ctx).rules;
  if (rules.rentBlockedInJail && ctx.resources.get(ownerId, SAC_JAIL_TURNS) > 0)
    return;
  const rent = rentFor(
    state,
    tileIndex,
    tile,
    ownerId,
    currentSacVariant(ctx),
    ctx.dice.last('pair')?.total ?? 0,
    ctx,
  );
  changeMoney(state, playerId, -rent, false, ctx);
  if (ctx.match.playerStatus(ownerId) === 'active')
    changeMoney(state, ownerId, rent, false, ctx);
  ctx.events.message('sac.rent.paid', {
    playerId,
    ownerId,
    amount: rent,
    tileId: tileIndex,
  });
}

function drawSacCard(
  playerId: number,
  deck: 'chance' | 'community',
  ctx: RuleContext,
): void {
  const deckId = `${deck}:${currentSacVariant(ctx).id}`;
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

export function applyCardMovement(
  state: SacState,
  playerId: number,
  movement: SacMovement,
  ctx: RuleContext,
): void {
  if (movement.kind === 'delta') {
    moveForward(state, playerId, movement.delta, 0, ctx);
    return;
  }
  const target = movementTarget(playerId, movement, ctx);
  if (target == null) return;
  const current = position(playerId, ctx);
  if (target < current || (movement.kind === 'start' && movement.collect)) {
    changeMoney(
      state,
      playerId,
      currentSacVariant(ctx).rules.passStartBonus,
      false,
      ctx,
    );
  }
  moveTo(playerId, target, ctx);
  resolveSacTile(state, playerId, 1, ctx);
}

function movementTarget(
  playerId: number,
  movement: Exclude<SacMovement, { kind: 'delta' }>,
  ctx: RuleContext,
): number | null {
  const variant = currentSacVariant(ctx);
  if (movement.kind === 'last') return variant.tiles.length - 1;
  if (movement.kind === 'start') return 0;
  if (movement.kind === 'next-station')
    return nextTileOfType(variant, position(playerId, ctx), 'station', 1);
  if (movement.kind === 'next-community')
    return nextTileOfType(variant, position(playerId, ctx), 'community', 1);
  if (movement.kind === 'previous-chance')
    return nextTileOfType(variant, position(playerId, ctx), 'chance', -1);
  if (movement.kind === 'next-group') {
    return nextGroupTile(variant, position(playerId, ctx), movement.group);
  }
  if (movement.kind !== 'named') return null;
  return findTile(
    variant,
    movement.name,
    movement.direction === 'forward' ? 1 : -1,
  );
}

function buyTile(
  state: SacState,
  playerId: number,
  tileIndex: number,
  ctx: RuleContext,
): void {
  const variant = currentSacVariant(ctx);
  const tile = variant.tiles[tileIndex];
  const price = purchasePrice(variant, tile);
  if (
    ctx.ownership.isOwned(PROPERTIES, String(tileIndex)) ||
    price <= 0 ||
    !ctx.resources.has(playerId, 'money', price)
  )
    return;
  changeMoney(state, playerId, -price, false, ctx);
  ctx.ownership.claim(PROPERTIES, String(tileIndex), playerId);
  state.buildings[tileIndex] = { houses: 0, hotel: false, mortgaged: false };
  ctx.events.message('sac.property.bought', {
    playerId,
    tileId: tileIndex,
    amount: price,
  });
}

export function managementOptions(
  state: SacState,
  playerId: number,
  kind: SacManagementKind,
  ctx: RuleContext,
): number[] {
  const variant = currentSacVariant(ctx);
  return variant.tiles.flatMap((tile, tileIndex) => {
    if (!ctx.ownership.isOwner(PROPERTIES, String(tileIndex), playerId)) {
      return [];
    }
    const building = buildingAt(state, tileIndex);
    if (kind === 'build') {
      const group = groupFor(variant, tile);
      if (
        !group ||
        building.mortgaged ||
        building.hotel ||
        !ownsGroup(state, playerId, variant, group, ctx)
      )
        return [];
      const cost = buildCost(group, building);
      return cost > 0 && ctx.resources.has(playerId, 'money', cost)
        ? [tileIndex]
        : [];
    }
    if (kind === 'sell')
      return building.hotel || building.houses > 0 ? [tileIndex] : [];
    if (kind === 'mortgage')
      return !building.mortgaged && !building.hotel && building.houses === 0
        ? [tileIndex]
        : [];
    const cost = unmortgageCost(variant, tile);
    return building.mortgaged && ctx.resources.has(playerId, 'money', cost)
      ? [tileIndex]
      : [];
  });
}

function applyManagement(
  state: SacState,
  playerId: number,
  kind: SacManagementKind,
  tileIndex: number,
  ctx: RuleContext,
): void {
  const variant = currentSacVariant(ctx);
  const tile = variant.tiles[tileIndex];
  const building = buildingAt(state, tileIndex);
  if (kind === 'build') {
    const group = groupFor(variant, tile);
    if (!group) return;
    const cost = buildCost(group, building);
    changeMoney(state, playerId, -cost, false, ctx);
    if (building.houses >= 4 && group.hotelPrice > 0) building.hotel = true;
    else building.houses += 1;
  } else if (kind === 'sell') {
    const group = groupFor(variant, tile);
    if (!group) return;
    const value = building.hotel
      ? group.hotelPrice
      : houseCost(group, Math.max(1, building.houses));
    if (building.hotel) building.hotel = false;
    else building.houses -= 1;
    changeMoney(state, playerId, Math.floor(value / 2), false, ctx);
  } else if (kind === 'mortgage') {
    building.mortgaged = true;
    changeMoney(state, playerId, mortgageValue(variant, tile), false, ctx);
  } else {
    building.mortgaged = false;
    changeMoney(state, playerId, -unmortgageCost(variant, tile), false, ctx);
  }
}
