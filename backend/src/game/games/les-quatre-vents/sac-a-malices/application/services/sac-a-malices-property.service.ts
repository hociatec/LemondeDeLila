import type { GameStateEntity } from '../../../../../core/application/models/game-state.model';
import { GameCoreService } from '../../../../../core/application/services/game-core.service';
import type {
  SacGroupsJsonV1,
  SacMetadata,
  SacTile,
} from '../../model/sac-a-malices.types';
import {
  buildSacAMalicesProperty,
  mortgageSacAMalicesTile,
  sellSacAMalicesProperty,
  unmortgageSacAMalicesTile,
} from '../../actions/sac-a-malices-property-management.helper';

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function normalize(value: string): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[’'`]/g, "'")
    .replace(/\s+/g, ' ');
}

function getHouseCost(
  group: SacMetadata['data']['groups'][number] | null,
  level: number,
): number {
  if (!group) return 0;
  const levelKey = String(clamp(level, 1, 4)) as '1' | '2' | '3' | '4';
  const perLevel = group.housePrices?.[levelKey];
  if (Number.isFinite(perLevel ?? NaN)) return Number(perLevel);
  return group.housePrice ?? 0;
}

export class SacAMalicesPropertyService {
  constructor(private readonly core: GameCoreService) {}

  getBuilding(
    meta: SacMetadata,
    tileIndex: number,
  ): { houses: number; hotel: boolean; mortgaged: boolean } {
    const current = meta.buildings?.[tileIndex];
    return {
      houses: clamp(Number(current?.houses ?? 0) || 0, 0, 4),
      hotel: Boolean(current?.hotel),
      mortgaged: Boolean(current?.mortgaged),
    };
  }

  setBuilding(
    state: GameStateEntity,
    tileIndex: number,
    patch: Partial<{ houses: number; hotel: boolean; mortgaged: boolean }>,
    getMeta: (state: GameStateEntity) => SacMetadata,
  ): GameStateEntity {
    const meta = getMeta(state);
    const current = this.getBuilding(meta, tileIndex);
    const nextBuilding = {
      houses: clamp(Number(patch.houses ?? current.houses) || 0, 0, 4),
      hotel: patch.hotel != null ? Boolean(patch.hotel) : current.hotel,
      mortgaged:
        patch.mortgaged != null ? Boolean(patch.mortgaged) : current.mortgaged,
    };
    const nextMeta: SacMetadata = {
      ...meta,
      buildings: { ...(meta.buildings ?? {}), [tileIndex]: nextBuilding },
    };
    return { ...state, metadata: { ...(state.metadata ?? {}), ...nextMeta } };
  }

  getGroup(meta: SacMetadata, rawGroup: string) {
    const key = normalize(rawGroup);
    if (!key) return null;
    return meta.data?.groups?.find((g) => normalize(g.color) === key) ?? null;
  }

  isGroupComplete(
    meta: SacMetadata,
    ownerId: number,
    group: SacGroupsJsonV1['groups'][number] | null,
    findTileByName: (tiles: SacTile[] | undefined, rawName: string) => number | null,
  ): boolean {
    const props: string[] = Array.isArray(group?.properties)
      ? group.properties
      : [];
    if (!props.length) return false;
    const idxs = props
      .map((name) => findTileByName(meta.tiles, name))
      .filter((idx) => idx != null);
    if (!idxs.length) return false;
    return idxs.every(
      (idx) =>
        meta.ownership?.[idx] === ownerId &&
        !this.getBuilding(meta, idx).mortgaged,
    );
  }

  getMortgageValue(meta: SacMetadata, tile: SacTile): number {
    if (tile.type === 'station') return meta.data?.stations?.mortgage ?? 0;
    if (tile.type === 'utility') {
      const u = meta.data?.utilities?.find(
        (x) => normalize(x.name) === normalize(tile.title),
      );
      return u?.mortgage ?? 0;
    }
    if (tile.type === 'property') {
      const group = this.getGroup(meta, tile.group ?? '');
      return group?.mortgage ?? 0;
    }
    return 0;
  }

  getUnmortgageCost(meta: SacMetadata, tile: SacTile): number {
    if (tile.type === 'station')
      return meta.data?.stations?.unmortgageCost ?? 0;
    if (tile.type === 'utility') {
      const u = meta.data?.utilities?.find(
        (x) => normalize(x.name) === normalize(tile.title),
      );
      return u?.unmortgageCost ?? 0;
    }
    if (tile.type === 'property') {
      const group = this.getGroup(meta, tile.group ?? '');
      return group?.unmortgageCost ?? 0;
    }
    return 0;
  }

  buildOne(
    state: GameStateEntity,
    playerId: number,
    tileIndex: number,
    getMeta: (state: GameStateEntity) => SacMetadata,
    findTileByName: (tiles: SacTile[] | undefined, rawName: string) => number | null,
    addMoney: (
      state: GameStateEntity,
      playerId: number,
      delta: number,
      options: { toPot: boolean },
    ) => GameStateEntity,
  ): GameStateEntity {
    return buildSacAMalicesProperty({
      state,
      playerId,
      tileIndex,
      getMeta: (current) => getMeta(current),
      getGroup: (meta, rawGroup) => this.getGroup(meta, rawGroup),
      isGroupComplete: (meta, ownerId, group) =>
        this.isGroupComplete(meta, ownerId, group, findTileByName),
      getBuilding: (meta, index) => this.getBuilding(meta, index),
      addMoney: (current, ownerId, delta, options) =>
        addMoney(current, ownerId, delta, options),
      setBuilding: (current, index, patch) =>
        this.setBuilding(current, index, patch, getMeta),
      appendLog: (current, message) => this.core.appendLog(current, message),
    });
  }

  sellOne(
    state: GameStateEntity,
    playerId: number,
    tileIndex: number,
    getMeta: (state: GameStateEntity) => SacMetadata,
    addMoney: (
      state: GameStateEntity,
      playerId: number,
      delta: number,
      options: { toPot: boolean },
    ) => GameStateEntity,
  ): GameStateEntity {
    return sellSacAMalicesProperty({
      state,
      playerId,
      tileIndex,
      getMeta: (current) => getMeta(current),
      getGroup: (meta, rawGroup) => this.getGroup(meta, rawGroup),
      getBuilding: (meta, index) => this.getBuilding(meta, index),
      addMoney: (current, ownerId, delta, options) =>
        addMoney(current, ownerId, delta, options),
      setBuilding: (current, index, patch) =>
        this.setBuilding(current, index, patch, getMeta),
      appendLog: (current, message) => this.core.appendLog(current, message),
    });
  }

  mortgageTile(
    state: GameStateEntity,
    playerId: number,
    tileIndex: number,
    getMeta: (state: GameStateEntity) => SacMetadata,
    addMoney: (
      state: GameStateEntity,
      playerId: number,
      delta: number,
      options: { toPot: boolean },
    ) => GameStateEntity,
  ): GameStateEntity {
    return mortgageSacAMalicesTile({
      state,
      playerId,
      tileIndex,
      getMeta: (current) => getMeta(current),
      getBuilding: (meta, index) => this.getBuilding(meta, index),
      getMortgageValue: (meta, tile) => this.getMortgageValue(meta, tile),
      addMoney: (current, ownerId, delta, options) =>
        addMoney(current, ownerId, delta, options),
      setBuilding: (current, index, patch) =>
        this.setBuilding(current, index, patch, getMeta),
      appendLog: (current, message) => this.core.appendLog(current, message),
    });
  }

  unmortgageTile(
    state: GameStateEntity,
    playerId: number,
    tileIndex: number,
    getMeta: (state: GameStateEntity) => SacMetadata,
    addMoney: (
      state: GameStateEntity,
      playerId: number,
      delta: number,
      options: { toPot: boolean },
    ) => GameStateEntity,
  ): GameStateEntity {
    return unmortgageSacAMalicesTile({
      state,
      playerId,
      tileIndex,
      getMeta: (current) => getMeta(current),
      getBuilding: (meta, index) => this.getBuilding(meta, index),
      getUnmortgageCost: (meta, tile) => this.getUnmortgageCost(meta, tile),
      addMoney: (current, ownerId, delta, options) =>
        addMoney(current, ownerId, delta, options),
      setBuilding: (current, index, patch) =>
        this.setBuilding(current, index, patch, getMeta),
      appendLog: (current, message) => this.core.appendLog(current, message),
    });
  }

  getHouseCost(
    group: SacMetadata['data']['groups'][number] | null,
    level: number,
  ): number {
    return getHouseCost(group, level);
  }
}




