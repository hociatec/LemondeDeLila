import type { GameStateEntity } from '../../../../application/models/game-state.model';
import type {
  SacGroupsJsonV1,
  SacMetadata,
  SacTile,
} from '../model/sac-a-malices.types';

type SacBuildingState = {
  houses: number;
  hotel: boolean;
  mortgaged: boolean;
};

function getHouseCost(
  group: SacGroupsJsonV1['groups'][number] | null,
  level: number,
): number {
  if (!group) return 0;
  const levelKey = String(Math.max(1, Math.min(4, level))) as '1' | '2' | '3' | '4';
  const perLevel = group.housePrices?.[levelKey];
  if (Number.isFinite(perLevel ?? NaN)) return Number(perLevel);
  return group.housePrice ?? 0;
}

function supportsHotel(group: SacGroupsJsonV1['groups'][number] | null): boolean {
  return Number(group?.hotelPrice ?? 0) > 0 && Number(group?.rents?.hotel ?? 0) > 0;
}

export function buildSacAMalicesProperty(input: {
  state: GameStateEntity;
  playerId: number;
  tileIndex: number;
  getMeta: (state: GameStateEntity) => SacMetadata;
  getGroup: (
    meta: SacMetadata,
    rawGroup: string,
  ) => SacGroupsJsonV1['groups'][number] | null;
  isGroupComplete: (
    meta: SacMetadata,
    ownerId: number,
    group: SacGroupsJsonV1['groups'][number] | null,
  ) => boolean;
  getBuilding: (meta: SacMetadata, tileIndex: number) => SacBuildingState;
  addMoney: (
    state: GameStateEntity,
    playerId: number,
    delta: number,
    options: { toPot: boolean },
  ) => GameStateEntity;
  setBuilding: (
    state: GameStateEntity,
    tileIndex: number,
    patch: Partial<SacBuildingState>,
  ) => GameStateEntity;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
}): GameStateEntity {
  const meta = input.getMeta(input.state);
  const tile = meta.tiles?.[input.tileIndex];
  if (!tile || tile.type !== 'property') return input.state;
  const group = input.getGroup(meta, tile.group ?? '');
  if (!group) return input.state;
  if (!input.isGroupComplete(meta, input.playerId, group)) return input.state;

  const building = input.getBuilding(meta, input.tileIndex);
  if (building.mortgaged || building.hotel) return input.state;
  const hotelEnabled = supportsHotel(group);
  if (!hotelEnabled && building.houses >= 4) return input.state;

  const nextLevel = Math.max(1, Math.min(4, building.houses + 1));
  const houseCost = getHouseCost(group, nextLevel);
  const cost =
    hotelEnabled && building.houses >= 4
      ? Number(group.hotelPrice ?? 0) || 0
      : houseCost;
  const cash = meta.money?.[input.playerId] ?? 0;
  if (!Number.isFinite(cost) || cost <= 0 || cash < cost) return input.state;

  let next = input.addMoney(input.state, input.playerId, -cost, { toPot: false });
  if (input.getMeta(next).statuses?.eliminated?.[input.playerId]) return next;

  if (hotelEnabled && building.houses >= 4) {
    next = input.appendLog(next, `Hôtel construit sur "${tile.title}".`);
    return input.setBuilding(next, input.tileIndex, { hotel: true, houses: 0 });
  }
  next = input.appendLog(next, `Maison construite sur "${tile.title}".`);
  return input.setBuilding(next, input.tileIndex, {
    houses: building.houses + 1,
    hotel: false,
  });
}

export function sellSacAMalicesProperty(input: {
  state: GameStateEntity;
  playerId: number;
  tileIndex: number;
  getMeta: (state: GameStateEntity) => SacMetadata;
  getGroup: (
    meta: SacMetadata,
    rawGroup: string,
  ) => SacGroupsJsonV1['groups'][number] | null;
  getBuilding: (meta: SacMetadata, tileIndex: number) => SacBuildingState;
  addMoney: (
    state: GameStateEntity,
    playerId: number,
    delta: number,
    options: { toPot: boolean },
  ) => GameStateEntity;
  setBuilding: (
    state: GameStateEntity,
    tileIndex: number,
    patch: Partial<SacBuildingState>,
  ) => GameStateEntity;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
}): GameStateEntity {
  const meta = input.getMeta(input.state);
  const tile = meta.tiles?.[input.tileIndex];
  if (!tile || tile.type !== 'property') return input.state;
  const group = input.getGroup(meta, tile.group ?? '');
  if (!group) return input.state;

  const building = input.getBuilding(meta, input.tileIndex);
  if (!building.hotel && building.houses <= 0) return input.state;

  if (supportsHotel(group) && building.hotel) {
    const refund = Math.floor((group.hotelPrice ?? 0) / 2);
    let next = input.appendLog(
      input.state,
      `Hôtel vendu sur "${tile.title}" (+${refund} €).`,
    );
    next = input.setBuilding(next, input.tileIndex, { hotel: false, houses: 4 });
    return input.addMoney(next, input.playerId, refund, { toPot: false });
  }

  const level = Math.max(1, Math.min(4, building.houses));
  const refund = Math.floor(getHouseCost(group, level) / 2);
  let next = input.appendLog(
    input.state,
    `Maison vendue sur "${tile.title}" (+${refund} €).`,
  );
  next = input.setBuilding(next, input.tileIndex, {
    houses: Math.max(0, building.houses - 1),
  });
  return input.addMoney(next, input.playerId, refund, { toPot: false });
}

export function mortgageSacAMalicesTile(input: {
  state: GameStateEntity;
  playerId: number;
  tileIndex: number;
  getMeta: (state: GameStateEntity) => SacMetadata;
  getBuilding: (meta: SacMetadata, tileIndex: number) => SacBuildingState;
  getMortgageValue: (meta: SacMetadata, tile: SacTile) => number;
  addMoney: (
    state: GameStateEntity,
    playerId: number,
    delta: number,
    options: { toPot: boolean },
  ) => GameStateEntity;
  setBuilding: (
    state: GameStateEntity,
    tileIndex: number,
    patch: Partial<SacBuildingState>,
  ) => GameStateEntity;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
}): GameStateEntity {
  const meta = input.getMeta(input.state);
  const tile = meta.tiles?.[input.tileIndex];
  if (!tile) return input.state;
  if (meta.ownership?.[input.tileIndex] !== input.playerId) return input.state;

  const building = input.getBuilding(meta, input.tileIndex);
  if (building.mortgaged) return input.state;
  if (tile.type === 'property' && (building.hotel || building.houses > 0)) {
    return input.state;
  }

  const amount = input.getMortgageValue(meta, tile);
  if (!Number.isFinite(amount) || amount <= 0) return input.state;

  let next = input.appendLog(
    input.state,
    `Hypothèque : "${tile.title}" (+${amount} €).`,
  );
  next = input.setBuilding(next, input.tileIndex, { mortgaged: true });
  return input.addMoney(next, input.playerId, amount, { toPot: false });
}

export function unmortgageSacAMalicesTile(input: {
  state: GameStateEntity;
  playerId: number;
  tileIndex: number;
  getMeta: (state: GameStateEntity) => SacMetadata;
  getBuilding: (meta: SacMetadata, tileIndex: number) => SacBuildingState;
  getUnmortgageCost: (meta: SacMetadata, tile: SacTile) => number;
  addMoney: (
    state: GameStateEntity,
    playerId: number,
    delta: number,
    options: { toPot: boolean },
  ) => GameStateEntity;
  setBuilding: (
    state: GameStateEntity,
    tileIndex: number,
    patch: Partial<SacBuildingState>,
  ) => GameStateEntity;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
}): GameStateEntity {
  const meta = input.getMeta(input.state);
  const tile = meta.tiles?.[input.tileIndex];
  if (!tile) return input.state;
  if (meta.ownership?.[input.tileIndex] !== input.playerId) return input.state;

  const building = input.getBuilding(meta, input.tileIndex);
  if (!building.mortgaged) return input.state;

  const cost = input.getUnmortgageCost(meta, tile);
  const cash = meta.money?.[input.playerId] ?? 0;
  if (!Number.isFinite(cost) || cost <= 0 || cash < cost) return input.state;

  let next = input.appendLog(
    input.state,
    `Levée d’hypothèque : "${tile.title}" (-${cost} €).`,
  );
  next = input.addMoney(next, input.playerId, -cost, { toPot: false });
  if (input.getMeta(next).statuses?.eliminated?.[input.playerId]) return next;
  return input.setBuilding(next, input.tileIndex, { mortgaged: false });
}




