import type { GameStateEntity } from '../../../../../application/models/game-state.model';
import { resolvePlayerNameFromState } from '../../../../../application/helpers/player-name.helper';
import { GameCoreService } from '../../../../../application/services/game-core.service';
import type { SacMetadata, SacTile } from '../../model/sac-a-malices.types';
import { SacAMalicesPropertyService } from './sac-a-malices-property.service';

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function stripParens(text: string): string {
  return String(text ?? '')
    .replace(/\([^)]*\)/g, '')
    .trim();
}

function normalize(value: string): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢'`]/g, "'")
    .replace(/\s+/g, ' ');
}

export class SacAMalicesEconomyService {
  constructor(
    private readonly core: GameCoreService,
    private readonly propertySvc: SacAMalicesPropertyService,
  ) {}

  findTileByName(
    tiles: SacTile[] | undefined,
    rawName: string,
  ): number | null {
    const name = normalize(rawName);
    if (!name) return null;
    const list = Array.isArray(tiles) ? tiles : [];
    const idx = list.findIndex((t) =>
      normalize(stripParens(t?.title ?? '')).includes(name),
    );
    return idx >= 0 ? idx : null;
  }

  loseOneInfrastructure(
    state: GameStateEntity,
    playerId: number,
    getMeta: (state: GameStateEntity) => SacMetadata,
    pickOne: (
      meta: SacMetadata,
      values: number[],
    ) => { value: number | null; meta: Partial<SacMetadata> },
  ): GameStateEntity {
    const meta0 = getMeta(state);
    const tiles = Array.isArray(meta0.tiles) ? meta0.tiles : [];

    const ownedWithInfra: number[] = [];
    for (let i = 0; i < tiles.length; i += 1) {
      const owner = meta0.ownership?.[i];
      if (owner !== playerId) continue;
      const tile = tiles[i];
      if (!tile || tile.type !== 'property') continue;
      const b = this.propertySvc.getBuilding(meta0, i);
      if (b.hotel || b.houses > 0) ownedWithInfra.push(i);
    }

    if (!ownedWithInfra.length) {
      return this.core.appendLog(state, 'Aucune infrastructure ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â  perdre.');
    }

    const picked = pickOne(meta0, ownedWithInfra);
    let next: GameStateEntity = {
      ...state,
      metadata: {
        ...(state.metadata ?? {}),
        ...meta0,
        ...picked.meta,
      },
    };
    const tileIndex = picked.value;
    if (tileIndex == null) return next;

    const tile = tiles[tileIndex];
    const group = tile
      ? this.propertySvc.getGroup(getMeta(next), tile.group ?? '')
      : null;
    const supportsHotel =
      Number(group?.hotelPrice ?? 0) > 0 &&
      Number(group?.rents?.hotel ?? 0) > 0;

    const b = this.propertySvc.getBuilding(getMeta(next), tileIndex);
    if (supportsHotel && b.hotel) {
      next = this.core.appendLog(
        next,
        `Infrastructure perdue : hÃ´tel sur "${tile?.title ?? 'propriÃ©tÃ©'}".`,
      );
      return this.propertySvc.setBuilding(next, tileIndex, {
        hotel: false,
        houses: 4,
      });
    }
    if (b.houses > 0) {
      next = this.core.appendLog(
        next,
        `Infrastructure perdue : -1 sur "${tile?.title ?? 'propriÃ©tÃ©'}".`,
      );
      return this.propertySvc.setBuilding(next, tileIndex, {
        houses: Math.max(0, b.houses - 1),
      });
    }
    return next;
  }

  addMoney(
    state: GameStateEntity,
    playerId: number,
    delta: number,
    options: { toPot: boolean },
    getMeta: (state: GameStateEntity) => SacMetadata,
  ): GameStateEntity {
    const meta = getMeta(state);
    const current = meta.money?.[playerId] ?? 0;
    const nextMoney = current + delta;
    const rules = this.getRules(meta);
    const nextMeta: SacMetadata = {
      ...meta,
      money: { ...(meta.money ?? {}), [playerId]: nextMoney },
      pot:
        rules.potEnabled && options.toPot
          ? (meta.pot ?? 0) + Math.max(0, -delta)
          : (meta.pot ?? 0),
    };
    let next: GameStateEntity = {
      ...state,
      metadata: { ...(state.metadata ?? {}), ...nextMeta },
    };
    if (nextMoney < 0) {
      next = this.core.appendLog(
        next,
        `${resolvePlayerNameFromState(next, playerId)} est en faillite !`,
      );
      next = this.setEliminated(next, playerId, true, getMeta);
      next = this.releaseAssets(next, playerId, getMeta);
    }
    return next;
  }

  releaseAssets(
    state: GameStateEntity,
    playerId: number,
    getMeta: (state: GameStateEntity) => SacMetadata,
  ): GameStateEntity {
    const meta = getMeta(state);
    const ownership = { ...(meta.ownership ?? {}) } as Record<string, unknown>;
    const buildings = { ...(meta.buildings ?? {}) } as Record<string, unknown>;
    for (const [k, v] of Object.entries(ownership)) {
      if (Number(v) === playerId) {
        delete ownership[k];
        delete buildings[k];
      }
    }

    const money = { ...(meta.money ?? {}), [playerId]: 0 };
    const statuses = meta.statuses;
    const nextMeta: SacMetadata = {
      ...meta,
      ownership,
      buildings,
      money,
      statuses: {
        ...statuses,
        inJail: { ...(statuses.inJail ?? {}), [playerId]: 0 },
        skipTurn: { ...(statuses.skipTurn ?? {}), [playerId]: 0 },
        extraRoll: { ...(statuses.extraRoll ?? {}), [playerId]: false },
        consecutiveDoubles: {
          ...(statuses.consecutiveDoubles ?? {}),
          [playerId]: 0,
        },
      },
    };
    return { ...state, metadata: { ...(state.metadata ?? {}), ...nextMeta } };
  }

  setEliminated(
    state: GameStateEntity,
    playerId: number,
    value: boolean,
    getMeta: (state: GameStateEntity) => SacMetadata,
  ): GameStateEntity {
    const meta = getMeta(state);
    const nextMeta: SacMetadata = {
      ...meta,
      statuses: {
        ...meta.statuses,
        eliminated: {
          ...(meta.statuses.eliminated ?? {}),
          [playerId]: Boolean(value),
        },
      },
    };
    return { ...state, metadata: { ...(state.metadata ?? {}), ...nextMeta } };
  }

  getPurchasePrice(meta: SacMetadata, tile: SacTile): number {
    if (tile.type === 'station') return meta.data?.stations?.purchasePrice ?? 0;
    if (tile.type === 'utility') {
      const u = meta.data?.utilities?.find(
        (x) => normalize(x.name) === normalize(tile.title),
      );
      return u?.purchasePrice ?? 0;
    }
    if (tile.type === 'property') {
      const group = meta.data?.groups?.find(
        (g) => normalize(g.color) === normalize(tile.group ?? ''),
      );
      return group?.purchasePrice ?? 0;
    }
    return 0;
  }

  getRent(
    meta: SacMetadata,
    tile: SacTile,
    tileIndex: number,
    ownerId: number,
    lastRoll: number,
  ): number {
    if (tile.type === 'station') {
      const stations = meta.data?.stations?.properties ?? [];
      const count = stations
        .map((name) => this.findTileByName(meta.tiles, name))
        .filter((idx) => idx != null)
        .filter((idx) => meta.ownership?.[idx] === ownerId).length;
      const rents = meta.data?.stations?.rents ?? ({} as Record<string, number>);
      const key = String(clamp(count, 1, 4)) as '1' | '2' | '3' | '4';
      return Number(rents[key] ?? 0) || 0;
    }

    if (tile.type === 'utility') {
      const utils = meta.data?.utilities ?? [];
      const idxs = utils
        .map((u) => this.findTileByName(meta.tiles, u.name))
        .filter((idx) => idx != null);
      const owned = idxs.filter(
        (idx) => meta.ownership?.[idx] === ownerId,
      ).length;
      const multiplier =
        owned >= 2
          ? (utils[0]?.multiplier2 ?? 10)
          : (utils[0]?.multiplier1 ?? 4);
      return Math.max(0, Math.trunc(multiplier * Math.max(0, lastRoll)));
    }

    if (tile.type === 'property') {
      const group = meta.data?.groups?.find(
        (g) => normalize(g.color) === normalize(tile.group ?? ''),
      );
      if (!group) return 0;
      const b = this.propertySvc.getBuilding(meta, tileIndex);
      if (b.hotel) return Number(group.rents?.hotel ?? 0) || 0;
      const houses = clamp(Number(b.houses ?? 0) || 0, 0, 4);
      if (houses <= 0) return Number(group.rents?.base ?? 0) || 0;
      if (houses === 1) return Number(group.rents?.house1 ?? 0) || 0;
      if (houses === 2) return Number(group.rents?.house2 ?? 0) || 0;
      if (houses === 3) return Number(group.rents?.house3 ?? 0) || 0;
      return Number(group.rents?.house4 ?? 0) || 0;
    }

    return 0;
  }

  private getRules(meta: SacMetadata): NonNullable<SacMetadata['rules']> {
    type SacStatuses = NonNullable<SacMetadata['statuses']>;
    type SacRulesRecord = Record<string, unknown> & {
      jail?: Record<string, unknown>;
    };

    type SacRulesRecord = Record<string, unknown> & {
      jail?: Record<string, unknown>;
    };
    const defaults: NonNullable<SacMetadata['rules']> = {
      startMoney: 2000,
      passStartBonus: 200,
      potEnabled: true,
      rentBlockedInJail: true,
      jail: {
        maxTurns: 3,
        autoFine: 100,
        allowPayFine: true,
        allowDoubleEscape: false,
      },
    };
    const statuses = meta.statuses as SacStatuses | undefined;
    const r = (meta.rules ?? {}) as SacRulesRecord;
    return {
      ...defaults,
      ...r,
      jail: { ...defaults.jail, ...(r.jail ?? {}) },
    };
  }
}




