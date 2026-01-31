import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { GameContentLoaderService } from '../../../../engine/services/game-content-loader.service';
import { RandomService } from '../../../../modules/random/services/random.service';
import type {
  SacBoardJsonV1,
  SacCardsJsonV1,
  SacGroupsJsonV1,
  SacMetadata,
  SacStationsJsonV1,
  SacUtilitiesJsonV1,
  SacVariantId,
} from '../model/sac-a-malices.types';
import {
  SAC_VARIANT_BY_ID,
  SAC_VARIANTS,
  parseVariantInput,
  type SacVariantConfig,
} from '../sac-a-malices-variants';

@Injectable()
export class SacAMalicesSetupService {
  constructor(
    private readonly contentLoader: GameContentLoaderService,
    private readonly random: RandomService,
  ) {}

  hydrateInitialState(base: GameStateEntity): GameStateEntity {
    const meta = (base.metadata ?? {}) as SacMetadata;
    const variantId = this.resolveVariantId(meta?.variantId);
    if (!variantId) {
      return this.buildSetupState(base);
    }
    return this.buildConfiguredState(base, variantId);
  }

  applyVariantSelection(base: GameStateEntity, variantId: SacVariantId): GameStateEntity {
    return this.buildConfiguredState(base, variantId);
  }

  private resolveVariantId(raw: unknown): SacVariantId | null {
    const parsed = parseVariantInput(raw);
    if (parsed && SAC_VARIANT_BY_ID[parsed]) return parsed;
    return null;
  }

  private buildSetupState(base: GameStateEntity): GameStateEntity {
    const players = Array.isArray(base.players) ? base.players : [];
    const meta = (base.metadata ?? {}) as SacMetadata;
    const ownerId =
      typeof (meta as any)?.ownerPlayerId === 'number'
        ? (meta as any).ownerPlayerId
        : (players[0]?.id ?? null);
    const starterId =
      typeof meta.setupStarterId === 'number'
        ? meta.setupStarterId
        : (base.turn?.currentPlayerId ?? players[0]?.id ?? null);

    return {
      ...base,
      phase: 'setup',
      pending: null,
      turn: {
        ...(base.turn ?? { direction: 1 }),
        currentPlayerId: ownerId ?? base.turn?.currentPlayerId ?? null,
        direction: 1,
      },
      metadata: {
        ...(base.metadata ?? {}),
        setupStep: 'setup_config',
        setupStarterId: starterId,
        variantId: meta.variantId ?? undefined,
      } as SacMetadata,
    };
  }

  private buildConfiguredState(base: GameStateEntity, variantId: SacVariantId): GameStateEntity {
    const variant = SAC_VARIANT_BY_ID[variantId] ?? SAC_VARIANTS[0];
    const board = this.loadBoard(variant);
    const groups = this.loadGroups(variant);
    const stations = this.loadStations(variant);
    const utilities = this.loadUtilities(variant);
    const chance = this.loadCards(variant, 'chance-cards.json');
    const community = this.loadCards(variant, 'community-cards.json');

    const players = Array.isArray(base.players) ? base.players : [];
    const positions: Record<number, number> = {};
    const money: Record<number, number> = {};
    const startMoney = Number(variant.rules.startMoney ?? 0) || 0;
    for (const p of players) {
      positions[p.id] = 0;
      money[p.id] = startMoney;
    }

    const seedMeta = (base.metadata ?? {}) as any;
    const s1 = this.random.shuffle(seedMeta, chance.cards ?? []);
    const s2 = this.random.shuffle(s1.meta, community.cards ?? []);

    const meta: SacMetadata = {
      variantId: variant.id,
      setupStep: 'playing',
      setupStarterId: null,
      tiles: board.tiles ?? [],
      positions,
      money,
      ownership: {},
      buildings: {},
      statuses: {
        skipTurn: {},
        inJail: {},
        eliminated: {},
        getOutOfJail: {},
        extraRoll: {},
        consecutiveDoubles: {},
      },
      pot: 0,
      rules: variant.rules,
      decks: {
        chance: { cards: s1.values as any, discard: [] },
        community: { cards: s2.values as any, discard: [] },
      },
      data: {
        groups: groups.groups ?? [],
        stations: stations.stations,
        utilities: utilities.utilities ?? [],
      },
      winnerId: null,
    };

    const metaBase = (base.metadata ?? {}) as SacMetadata;
    const starterId =
      typeof metaBase.setupStarterId === 'number'
        ? metaBase.setupStarterId
        : (base.turn?.currentPlayerId ?? players[0]?.id ?? null);

    return {
      ...base,
      phase: 'playing',
      pending: null,
      turn: {
        ...(base.turn ?? { direction: 1 }),
        currentPlayerId: starterId ?? base.turn?.currentPlayerId ?? null,
        direction: 1,
      },
      metadata: {
        ...(base.metadata ?? {}),
        ...s2.meta,
        ...meta,
      },
    };
  }

  private loadBoard(variant: SacVariantConfig): SacBoardJsonV1 {
    const contentDir = variant.contentDir;
    return this.contentLoader.loadContent<SacBoardJsonV1>({
      gameType: variant.gameType,
      baseDir: __dirname,
      ...(contentDir ? { contentDir } : {}),
      filename: 'board.json',
      validators: [
        this.contentLoader.validators.version(1),
        this.contentLoader.validators.arrayField('tiles', 1),
      ],
    });
  }

  private loadGroups(variant: SacVariantConfig): SacGroupsJsonV1 {
    const contentDir = variant.contentDir;
    return this.contentLoader.loadContent<SacGroupsJsonV1>({
      gameType: variant.gameType,
      baseDir: __dirname,
      ...(contentDir ? { contentDir } : {}),
      filename: 'groups.json',
      validators: [
        this.contentLoader.validators.version(1),
        this.contentLoader.validators.arrayField('groups', 1),
      ],
    });
  }

  private loadStations(variant: SacVariantConfig): SacStationsJsonV1 {
    const contentDir = variant.contentDir;
    return this.contentLoader.loadContent<SacStationsJsonV1>({
      gameType: variant.gameType,
      baseDir: __dirname,
      ...(contentDir ? { contentDir } : {}),
      filename: 'stations.json',
      validators: [
        this.contentLoader.validators.version(1),
        this.contentLoader.validators.requiredFields('stations'),
      ],
    });
  }

  private loadUtilities(variant: SacVariantConfig): SacUtilitiesJsonV1 {
    const contentDir = variant.contentDir;
    return this.contentLoader.loadContent<SacUtilitiesJsonV1>({
      gameType: variant.gameType,
      baseDir: __dirname,
      ...(contentDir ? { contentDir } : {}),
      filename: 'utilities.json',
      validators: [
        this.contentLoader.validators.version(1),
        this.contentLoader.validators.arrayField('utilities', variant.utilitiesMin),
      ],
    });
  }

  private loadCards(variant: SacVariantConfig, filename: string): SacCardsJsonV1 {
    const contentDir = variant.contentDir;
    return this.contentLoader.loadContent<SacCardsJsonV1>({
      gameType: variant.gameType,
      baseDir: __dirname,
      ...(contentDir ? { contentDir } : {}),
      filename,
      validators: [
        this.contentLoader.validators.version(1),
        this.contentLoader.validators.arrayField('cards', 1),
      ],
    });
  }
}
