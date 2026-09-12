import type {
  PropertyEconomyGroup,
  PropertyEconomyProgram,
  PropertyEconomyTile,
  PropertyEconomyVariant,
  PropertyEconomyVariantId,
} from './program';
import type { GameContext } from '../../definitions/game-author-context';

export type PropertyEconomyState = Record<string, never>;
export type PropertyEconomyContext = GameContext<PropertyEconomyState>;
export type PropertyEconomyBuilding = {
  houses: number;
  hotel: boolean;
  mortgaged: boolean;
};
export type PropertyEconomyManagement =
  'build' | 'sell' | 'mortgage' | 'unmortgage';
export const PROPERTY_ECONOMY = {
  track: 'city',
  properties: 'properties',
  money: 'money',
  jailTurns: 'board-property-economy.jail-turns',
  jailCards: 'board-property-economy.jail-cards',
  doubles: 'board-property-economy.consecutive-doubles',
  pot: 'board-property-economy.pot',
} as const;

export function propertyEconomyBuildings(
  state: PropertyEconomyState,
): Record<number, PropertyEconomyBuilding> {
  const existing = Reflect.get(state, 'buildings') as
    Record<number, PropertyEconomyBuilding> | undefined;
  if (existing) return existing;
  const created: Record<number, PropertyEconomyBuilding> = {};
  Reflect.set(state, 'buildings', created);
  return created;
}
export function createPropertyEconomySupport(source: PropertyEconomyProgram) {
  const program = structuredClone(source);
  function current(ctx: PropertyEconomyContext): PropertyEconomyVariant {
    const id =
      ctx.config.get<PropertyEconomyVariantId>('variantId') ?? 'classic';
    return (
      program.variants.find((variant) => variant.id === id) ??
      program.variants[0]
    );
  }
  function buildingAt(
    state: PropertyEconomyState,
    tileIndex: number,
  ): PropertyEconomyBuilding {
    return (propertyEconomyBuildings(state)[tileIndex] ??= {
      houses: 0,
      hotel: false,
      mortgaged: false,
    });
  }
  function changeMoney(
    state: PropertyEconomyState,
    playerId: number,
    delta: number,
    toPot: boolean,
    ctx: PropertyEconomyContext,
  ) {
    if (ctx.match.playerStatus(playerId) === 'eliminated') return;
    const money = ctx.resources.add(playerId, PROPERTY_ECONOMY.money, delta);
    if (toPot && delta < 0 && current(ctx).rules.potEnabled)
      ctx.counters.add(PROPERTY_ECONOMY.pot, -delta);
    if (money >= 0) return;
    ctx.resources.set(playerId, PROPERTY_ECONOMY.money, 0);
    ctx.match.eliminate(playerId, 'bankruptcy');
    for (const assetId of ctx.ownership.releaseAll(
      PROPERTY_ECONOMY.properties,
      playerId,
    )) {
      const index = current(ctx).tiles.findIndex((tile) => tile.id === assetId);
      delete propertyEconomyBuildings(state)[index];
    }
    ctx.events.message('board-property-economy.player.bankrupt', { playerId });
    const alive = ctx.players.active();
    if (alive.length === 1)
      ctx.match.finish({
        winners: [alive[0].id],
        reason: 'last-solvent-player',
      });
  }
  function moveTo(
    playerId: number,
    target: number,
    ctx: PropertyEconomyContext,
  ) {
    ctx.movement.moveTo(PROPERTY_ECONOMY.track, playerId, target);
  }
  function sendToJail(
    _state: PropertyEconomyState,
    playerId: number,
    ctx: PropertyEconomyContext,
  ) {
    const variant = current(ctx);
    const jail = variant.tiles.findIndex(
      (tile) => tile.id === variant.rules.jail.tileId,
    );
    if (jail >= 0) moveTo(playerId, jail, ctx);
    ctx.resources.set(
      playerId,
      PROPERTY_ECONOMY.jailTurns,
      variant.rules.jail.maxTurns,
    );
    ctx.turn.clearExtra(playerId);
  }
  function groupFor(
    variant: PropertyEconomyVariant,
    tile: PropertyEconomyTile,
  ) {
    return variant.groups.find((group) => group.id === tile.groupId) ?? null;
  }
  function purchasePrice(
    variant: PropertyEconomyVariant,
    tile: PropertyEconomyTile,
  ) {
    if (tile.type === 'station') return variant.stations.purchasePrice;
    if (tile.type === 'utility')
      return (
        variant.utilities.find((utility) => utility.tileId === tile.id)
          ?.purchasePrice ?? 0
      );
    return groupFor(variant, tile)?.purchasePrice ?? 0;
  }
  function rentFor(
    state: PropertyEconomyState,
    tileIndex: number,
    tile: PropertyEconomyTile,
    ownerId: number,
    variant: PropertyEconomyVariant,
    lastRoll: number,
    ctx: PropertyEconomyContext,
  ) {
    if (tile.type === 'station') {
      const count = variant.tiles.filter(
        (candidate) =>
          candidate.type === 'station' &&
          ctx.ownership.isOwner(
            PROPERTY_ECONOMY.properties,
            candidate.id,
            ownerId,
          ),
      ).length;
      return variant.stations.rents[cappedLevel(count)];
    }
    if (tile.type === 'utility') {
      const count = variant.tiles.filter(
        (candidate) =>
          candidate.type === 'utility' &&
          ctx.ownership.isOwner(
            PROPERTY_ECONOMY.properties,
            candidate.id,
            ownerId,
          ),
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
  function ownsGroup(
    playerId: number,
    group: PropertyEconomyGroup,
    ctx: PropertyEconomyContext,
  ) {
    return group.propertyIds.every((id) =>
      ctx.ownership.isOwner(PROPERTY_ECONOMY.properties, id, playerId),
    );
  }
  function mortgageValue(
    variant: PropertyEconomyVariant,
    tile: PropertyEconomyTile,
  ) {
    if (tile.type === 'station') return variant.stations.mortgage;
    if (tile.type === 'utility')
      return (
        variant.utilities.find((utility) => utility.tileId === tile.id)
          ?.mortgage ?? 0
      );
    return groupFor(variant, tile)?.mortgage ?? 0;
  }
  function unmortgageCost(
    variant: PropertyEconomyVariant,
    tile: PropertyEconomyTile,
  ) {
    if (tile.type === 'station') return variant.stations.unmortgageCost;
    if (tile.type === 'utility')
      return (
        variant.utilities.find((utility) => utility.tileId === tile.id)
          ?.unmortgageCost ?? 0
      );
    return groupFor(variant, tile)?.unmortgageCost ?? 0;
  }
  function houseCost(group: PropertyEconomyGroup, level: number) {
    return group.housePrices?.[cappedLevel(level)] ?? group.housePrice;
  }
  function buildCost(
    group: PropertyEconomyGroup,
    building: PropertyEconomyBuilding,
  ) {
    return building.houses >= 4
      ? group.hotelPrice
      : houseCost(group, building.houses + 1);
  }
  function managementOptions(
    state: PropertyEconomyState,
    playerId: number,
    kind: PropertyEconomyManagement,
    ctx: PropertyEconomyContext,
  ) {
    const variant = current(ctx);
    return variant.tiles.flatMap((tile, tileIndex) => {
      if (
        !ctx.ownership.isOwner(PROPERTY_ECONOMY.properties, tile.id, playerId)
      )
        return [];
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
        return cost > 0 &&
          ctx.resources.has(playerId, PROPERTY_ECONOMY.money, cost)
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
      return building.mortgaged &&
        ctx.resources.has(playerId, PROPERTY_ECONOMY.money, cost)
        ? [tileIndex]
        : [];
    });
  }
  function applyManagement(
    state: PropertyEconomyState,
    playerId: number,
    kind: PropertyEconomyManagement,
    tileIndex: number,
    ctx: PropertyEconomyContext,
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
    state: PropertyEconomyState,
    playerId: number,
    ctx: PropertyEconomyContext,
  ) {
    const candidates = current(ctx).tiles.flatMap((tile, tileIndex) => {
      const building = propertyEconomyBuildings(state)[tileIndex];
      return building &&
        ctx.ownership.isOwner(PROPERTY_ECONOMY.properties, tile.id, playerId) &&
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
