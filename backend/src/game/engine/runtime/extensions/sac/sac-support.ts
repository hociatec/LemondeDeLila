import type {
  SacGroup,
  SacProgram,
  SacTile,
  SacVariant,
  SacVariantId,
} from './program';
import type { GameContext } from '../../definitions/game-author-context';

export type SacState = Record<string, never>;
export type SacContext = GameContext<SacState>;
export type SacBuilding = {
  houses: number;
  hotel: boolean;
  mortgaged: boolean;
};
export type SacManagement = 'build' | 'sell' | 'mortgage' | 'unmortgage';
export const SAC = {
  track: 'city',
  properties: 'properties',
  money: 'money',
  jailTurns: 'sac.jail-turns',
  jailCards: 'sac.jail-cards',
  doubles: 'sac.consecutive-doubles',
  pot: 'sac.pot',
} as const;

export function sacBuildings(state: SacState): Record<number, SacBuilding> {
  const existing = Reflect.get(state, 'buildings') as
    Record<number, SacBuilding> | undefined;
  if (existing) return existing;
  const created: Record<number, SacBuilding> = {};
  Reflect.set(state, 'buildings', created);
  return created;
}
export function createSacSupport(source: SacProgram) {
  const program = structuredClone(source);
  function current(ctx: SacContext): SacVariant {
    const id = ctx.config.get<SacVariantId>('variantId') ?? 'classic';
    return (
      program.variants.find((variant) => variant.id === id) ??
      program.variants[0]
    );
  }
  function buildingAt(state: SacState, tileIndex: number): SacBuilding {
    return (sacBuildings(state)[tileIndex] ??= {
      houses: 0,
      hotel: false,
      mortgaged: false,
    });
  }
  function changeMoney(
    state: SacState,
    playerId: number,
    delta: number,
    toPot: boolean,
    ctx: SacContext,
  ) {
    if (ctx.match.playerStatus(playerId) === 'eliminated') return;
    const money = ctx.resources.add(playerId, SAC.money, delta);
    if (toPot && delta < 0 && current(ctx).rules.potEnabled)
      ctx.counters.add(SAC.pot, -delta);
    if (money >= 0) return;
    ctx.resources.set(playerId, SAC.money, 0);
    ctx.match.eliminate(playerId, 'bankruptcy');
    for (const assetId of ctx.ownership.releaseAll(SAC.properties, playerId)) {
      const index = current(ctx).tiles.findIndex((tile) => tile.id === assetId);
      delete sacBuildings(state)[index];
    }
    ctx.events.message('sac.player.bankrupt', { playerId });
    const alive = ctx.players.active();
    if (alive.length === 1)
      ctx.match.finish({
        winners: [alive[0].id],
        reason: 'last-solvent-player',
      });
  }
  function moveTo(playerId: number, target: number, ctx: SacContext) {
    ctx.movement.moveTo(SAC.track, playerId, target);
  }
  function sendToJail(_state: SacState, playerId: number, ctx: SacContext) {
    const variant = current(ctx);
    const jail = variant.tiles.findIndex(
      (tile) => tile.id === variant.rules.jail.tileId,
    );
    if (jail >= 0) moveTo(playerId, jail, ctx);
    ctx.resources.set(playerId, SAC.jailTurns, variant.rules.jail.maxTurns);
    ctx.turn.clearExtra(playerId);
  }
  function groupFor(variant: SacVariant, tile: SacTile) {
    return variant.groups.find((group) => group.id === tile.groupId) ?? null;
  }
  function purchasePrice(variant: SacVariant, tile: SacTile) {
    if (tile.type === 'station') return variant.stations.purchasePrice;
    if (tile.type === 'utility')
      return (
        variant.utilities.find((utility) => utility.tileId === tile.id)
          ?.purchasePrice ?? 0
      );
    return groupFor(variant, tile)?.purchasePrice ?? 0;
  }
  function rentFor(
    state: SacState,
    tileIndex: number,
    tile: SacTile,
    ownerId: number,
    variant: SacVariant,
    lastRoll: number,
    ctx: SacContext,
  ) {
    if (tile.type === 'station') {
      const count = variant.tiles.filter(
        (candidate) =>
          candidate.type === 'station' &&
          ctx.ownership.isOwner(SAC.properties, candidate.id, ownerId),
      ).length;
      return variant.stations.rents[cappedLevel(count)];
    }
    if (tile.type === 'utility') {
      const count = variant.tiles.filter(
        (candidate) =>
          candidate.type === 'utility' &&
          ctx.ownership.isOwner(SAC.properties, candidate.id, ownerId),
      ).length;
      const utility = variant.utilities.find(
        (candidate) => candidate.tileId === tile.id,
      );
      return (
        lastRoll *
        (count >= 2
          ? (utility?.multiplier2 ?? 10)
          : (utility?.multiplier1 ?? 4))
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
  function ownsGroup(playerId: number, group: SacGroup, ctx: SacContext) {
    return group.propertyIds.every((id) =>
      ctx.ownership.isOwner(SAC.properties, id, playerId),
    );
  }
  function mortgageValue(variant: SacVariant, tile: SacTile) {
    if (tile.type === 'station') return variant.stations.mortgage;
    if (tile.type === 'utility')
      return (
        variant.utilities.find((utility) => utility.tileId === tile.id)
          ?.mortgage ?? 0
      );
    return groupFor(variant, tile)?.mortgage ?? 0;
  }
  function unmortgageCost(variant: SacVariant, tile: SacTile) {
    if (tile.type === 'station') return variant.stations.unmortgageCost;
    if (tile.type === 'utility')
      return (
        variant.utilities.find((utility) => utility.tileId === tile.id)
          ?.unmortgageCost ?? 0
      );
    return groupFor(variant, tile)?.unmortgageCost ?? 0;
  }
  function houseCost(group: SacGroup, level: number) {
    return group.housePrices?.[cappedLevel(level)] ?? group.housePrice;
  }
  function buildCost(group: SacGroup, building: SacBuilding) {
    return building.houses >= 4
      ? group.hotelPrice
      : houseCost(group, building.houses + 1);
  }
  function managementOptions(
    state: SacState,
    playerId: number,
    kind: SacManagement,
    ctx: SacContext,
  ) {
    const variant = current(ctx);
    return variant.tiles.flatMap((tile, tileIndex) => {
      if (!ctx.ownership.isOwner(SAC.properties, tile.id, playerId)) return [];
      const building = buildingAt(state, tileIndex);
      if (kind === 'build') {
        const group = groupFor(variant, tile);
        if (
          !group ||
          building.mortgaged ||
          building.hotel ||
          !ownsGroup(playerId, group, ctx)
        )
          return [];
        const cost = buildCost(group, building);
        return cost > 0 && ctx.resources.has(playerId, SAC.money, cost)
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
      return building.mortgaged && ctx.resources.has(playerId, SAC.money, cost)
        ? [tileIndex]
        : [];
    });
  }
  function applyManagement(
    state: SacState,
    playerId: number,
    kind: SacManagement,
    tileIndex: number,
    ctx: SacContext,
  ) {
    const variant = current(ctx);
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
  function loseInfrastructure(
    state: SacState,
    playerId: number,
    ctx: SacContext,
  ) {
    const candidates = current(ctx).tiles.flatMap((tile, tileIndex) => {
      const building = sacBuildings(state)[tileIndex];
      return building &&
        ctx.ownership.isOwner(SAC.properties, tile.id, playerId) &&
        (building.hotel || building.houses > 0)
        ? [tileIndex]
        : [];
    });
    const selected = ctx.random.pick(candidates);
    if (selected == null) return;
    const building = buildingAt(state, selected);
    if (building.hotel) building.hotel = false;
    else building.houses = Math.max(0, building.houses - 1);
  }
  return {
    program,
    current,
    buildingAt,
    changeMoney,
    moveTo,
    sendToJail,
    groupFor,
    purchasePrice,
    rentFor,
    mortgageValue,
    unmortgageCost,
    managementOptions,
    applyManagement,
    loseInfrastructure,
  };
}

function cappedLevel(level: number): '1' | '2' | '3' | '4' {
  if (level <= 1) return '1';
  if (level === 2) return '2';
  if (level === 3) return '3';
  return '4';
}
