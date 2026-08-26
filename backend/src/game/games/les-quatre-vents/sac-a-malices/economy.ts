import type { GameContext } from '../../../core/application/public-api';
import {
  sacVariant,
  type SacGroup,
  type SacTile,
  type SacVariant,
  type SacVariantId,
} from './content';
import type { SacBuilding, SacState } from './state';
import { normalize } from './text-parser';

type RuleContext = GameContext<SacState>;
const TRACK = 'city';
const PROPERTIES = 'properties';
export const SAC_JAIL_TURNS = 'sac.jail-turns';
export const SAC_JAIL_CARDS = 'sac.jail-cards';
export const SAC_CONSECUTIVE_DOUBLES = 'sac.consecutive-doubles';
export const SAC_POT = 'sac.pot';

export function changeMoney(
  state: SacState,
  playerId: number,
  delta: number,
  toPot: boolean,
  ctx: RuleContext,
): void {
  if (ctx.match.playerStatus(playerId) === 'eliminated') return;
  const money = ctx.resources.add(playerId, 'money', delta);
  const rules = currentSacVariant(ctx).rules;
  if (toPot && delta < 0 && rules.potEnabled) ctx.counters.add(SAC_POT, -delta);
  if (money >= 0) return;
  ctx.resources.set(playerId, 'money', 0);
  ctx.match.eliminate(playerId, 'bankruptcy');
  for (const assetId of ctx.ownership.releaseAll(PROPERTIES, playerId)) {
    delete state.buildings[Number(assetId)];
  }
  ctx.events.message('sac.player.bankrupt', { playerId });
  updateWinner(state, ctx);
}

export function updateWinner(_state: SacState, ctx: RuleContext): void {
  const alive = ctx.players.active();
  if (alive.length === 1) {
    ctx.match.finish({ winners: [alive[0].id], reason: 'last-solvent-player' });
  }
}

export function sendToJail(
  _state: SacState,
  playerId: number,
  ctx: RuleContext,
): void {
  const variant = currentSacVariant(ctx);
  const jail = variant.tiles.findIndex((tile) => tile.type === 'jail');
  if (jail >= 0) moveTo(playerId, jail, ctx);
  ctx.resources.set(playerId, SAC_JAIL_TURNS, variant.rules.jail.maxTurns);
  ctx.turn.clearExtra(playerId);
}

export function collectPot(
  state: SacState,
  playerId: number,
  variant: SacVariant,
  ctx: RuleContext,
): void {
  if (!variant.rules.potEnabled || ctx.counters.get(SAC_POT) <= 0) return;
  const amount = ctx.counters.get(SAC_POT);
  ctx.counters.set(SAC_POT, 0);
  changeMoney(state, playerId, amount, false, ctx);
}

export function payTax(
  state: SacState,
  playerId: number,
  tile: SacTile,
  ctx: RuleContext,
): void {
  const amount = Number(
    `${tile.title} ${tile.description ?? ''}`.match(/(\d+)/)?.[1] ?? 0,
  );
  if (amount > 0) changeMoney(state, playerId, -amount, true, ctx);
}

export function loseInfrastructure(
  state: SacState,
  playerId: number,
  ctx: RuleContext,
): void {
  const candidates = Object.entries(state.buildings)
    .filter(
      ([tileIndex, building]) =>
        ctx.ownership.isOwner(PROPERTIES, tileIndex, playerId) &&
        (building.hotel || building.houses > 0),
    )
    .map(([tileIndex]) => Number(tileIndex));
  const selected = ctx.random.pick(candidates);
  if (selected == null) return;
  const building = buildingAt(state, selected);
  if (building.hotel) building.hotel = false;
  else building.houses = Math.max(0, building.houses - 1);
}

export function purchasePrice(variant: SacVariant, tile: SacTile): number {
  if (tile.type === 'station') return variant.stations.purchasePrice;
  if (tile.type === 'utility')
    return (
      variant.utilities.find((utility) => sameName(utility.name, tile.title))
        ?.purchasePrice ?? 0
    );
  return groupFor(variant, tile)?.purchasePrice ?? 0;
}

export function rentFor(
  state: SacState,
  tileIndex: number,
  tile: SacTile,
  ownerId: number,
  variant: SacVariant,
  lastRoll: number,
  ctx: RuleContext,
): number {
  if (tile.type === 'station') {
    const count = variant.tiles.filter(
      (candidate, index) =>
        candidate.type === 'station' &&
        ctx.ownership.isOwner(PROPERTIES, String(index), ownerId),
    ).length;
    return variant.stations.rents[cappedLevel(count)];
  }
  if (tile.type === 'utility') {
    const owned = variant.tiles.filter(
      (candidate, index) =>
        candidate.type === 'utility' &&
        ctx.ownership.isOwner(PROPERTIES, String(index), ownerId),
    ).length;
    const utility = variant.utilities.find((candidate) =>
      sameName(candidate.name, tile.title),
    );
    return (
      lastRoll *
      (owned >= 2 ? (utility?.multiplier2 ?? 10) : (utility?.multiplier1 ?? 4))
    );
  }
  const group = groupFor(variant, tile);
  if (!group) return 0;
  const building = buildingAt(state, tileIndex);
  if (building.hotel) return group.rents.hotel;
  return [
    group.rents.base,
    group.rents.house1,
    group.rents.house2,
    group.rents.house3,
    group.rents.house4,
  ][building.houses];
}

export function currentSacVariant(ctx: RuleContext): SacVariant {
  return sacVariant(ctx.config.get<SacVariantId>('variantId') ?? 'classic');
}

export function groupFor(variant: SacVariant, tile: SacTile): SacGroup | null {
  return (
    variant.groups.find(
      (group) => normalize(group.color) === normalize(tile.group ?? ''),
    ) ?? null
  );
}

export function ownsGroup(
  _state: SacState,
  playerId: number,
  variant: SacVariant,
  group: SacGroup,
  ctx: RuleContext,
): boolean {
  return group.properties.every((name) => {
    const tileIndex = variant.tiles.findIndex((tile) =>
      sameName(name, tile.title),
    );
    return (
      tileIndex >= 0 &&
      ctx.ownership.isOwner(PROPERTIES, String(tileIndex), playerId)
    );
  });
}

export function mortgageValue(variant: SacVariant, tile: SacTile): number {
  if (tile.type === 'station') return variant.stations.mortgage;
  if (tile.type === 'utility')
    return (
      variant.utilities.find((utility) => sameName(utility.name, tile.title))
        ?.mortgage ?? 0
    );
  return groupFor(variant, tile)?.mortgage ?? 0;
}

export function unmortgageCost(variant: SacVariant, tile: SacTile): number {
  if (tile.type === 'station') return variant.stations.unmortgageCost;
  if (tile.type === 'utility')
    return (
      variant.utilities.find((utility) => sameName(utility.name, tile.title))
        ?.unmortgageCost ?? 0
    );
  return groupFor(variant, tile)?.unmortgageCost ?? 0;
}

export function buildCost(group: SacGroup, building: SacBuilding): number {
  return building.houses >= 4
    ? group.hotelPrice
    : houseCost(group, building.houses + 1);
}

export function houseCost(group: SacGroup, level: number): number {
  const key = cappedLevel(level);
  return group.housePrices?.[key] ?? group.housePrice;
}

function cappedLevel(level: number): '1' | '2' | '3' | '4' {
  if (level <= 1) return '1';
  if (level === 2) return '2';
  if (level === 3) return '3';
  return '4';
}

export function buildingAt(state: SacState, tileIndex: number): SacBuilding {
  return (state.buildings[tileIndex] ??= {
    houses: 0,
    hotel: false,
    mortgaged: false,
  });
}

export function nextTileOfType(
  variant: SacVariant,
  current: number,
  type: SacTile['type'],
  direction: 1 | -1,
): number | null {
  for (let distance = 1; distance < variant.tiles.length; distance += 1) {
    const index = modulo(current + distance * direction, variant.tiles.length);
    if (variant.tiles[index].type === type) return index;
  }
  return null;
}

export function nextGroupTile(
  variant: SacVariant,
  current: number,
  group: string,
): number | null {
  for (let distance = 1; distance < variant.tiles.length; distance += 1) {
    const index = modulo(current + distance, variant.tiles.length);
    if (normalize(variant.tiles[index].group ?? '') === normalize(group))
      return index;
  }
  return null;
}

export function findTile(
  variant: SacVariant,
  name: string,
  direction: number,
): number | null {
  const normalized = normalize(name).replace(/^(case|gare de) /, '');
  const index = variant.tiles.findIndex((tile) =>
    normalize(tile.title).includes(normalized),
  );
  if (index >= 0) return index;
  if (direction < 0) return nextTileOfType(variant, 0, 'chance', -1);
  return null;
}

export function isOwnable(tile: SacTile): boolean {
  return (
    tile.type === 'property' ||
    tile.type === 'station' ||
    tile.type === 'utility'
  );
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

export function modulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function sameName(left: string, right: string): boolean {
  const normalizedLeft = normalize(left);
  const normalizedRight = normalize(right)
    .replace(/\([^)]*\)/g, '')
    .trim();
  return (
    normalizedLeft === normalizedRight ||
    normalizedRight.includes(normalizedLeft)
  );
}
