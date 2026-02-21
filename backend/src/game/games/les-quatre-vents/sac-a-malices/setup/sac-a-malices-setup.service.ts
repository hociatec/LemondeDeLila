import { Injectable } from '@nestjs/common';
import type {
  GameStateEntity,
  PendingState,
} from '../../../../core/entities/game-state.entity';
import { GameContentLoaderService } from '../../../../engine/services/game-content-loader.service';
import { RandomService } from '../../../../modules/random/services/random.service';
import { SetupFlowService } from '../../../../modules/setup-flow/services/setup-flow.service';
import { loadV1Content } from '../../../../setup/content-loader.helper';
import { ensureSeededRng } from '../../../../../common/utils/seeded-rng';
import { seededShuffle } from '../../../../../common/utils/seeded-shuffle';
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

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

function toNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

@Injectable()
export class SacAMalicesSetupService {
  constructor(
    private readonly contentLoader: GameContentLoaderService,
    private readonly random: RandomService,
    private readonly setupFlow: SetupFlowService,
  ) {}

  hydrateInitialState(base: GameStateEntity): GameStateEntity {
    const meta = (base.metadata ?? {}) as SacMetadata;
    const variantId = this.resolveVariantId(meta?.variantId);
    if (!variantId) {
      return this.buildSetupState(base);
    }
    return this.buildConfiguredState(base, variantId);
  }

  applyVariantSelection(
    base: GameStateEntity,
    variantId: SacVariantId,
  ): GameStateEntity {
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
    const metaRecord = asRecord(meta);
    const ownerId =
      toNumber(metaRecord.ownerPlayerId) ?? players[0]?.id ?? null;
    const starterId =
      typeof meta.setupStarterId === 'number'
        ? meta.setupStarterId
        : this.resolveSeededStarterId(
            players,
            base.metadata ?? {},
            base.turn?.currentPlayerId ?? null,
          );

    const pendingInfo = this.buildVariantChoicePending(players, ownerId, meta);
    const pending = pendingInfo?.pending ?? null;
    const currentPlayerId =
      pendingInfo?.playerId ?? ownerId ?? base.turn?.currentPlayerId ?? null;
    const turnIndex = pendingInfo?.turnIndex ?? base.turnIndex;

    return {
      ...base,
      phase: 'setup',
      pending,
      turnIndex,
      turn: {
        ...(base.turn ?? { direction: 1 }),
        currentPlayerId,
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

  private buildVariantChoicePending(
    players: Array<{ id: number; username?: string | null }>,
    ownerId: number | null,
    meta: SacMetadata,
  ): { pending: PendingState; playerId: number; turnIndex: number } | null {
    if (!players.length) return null;
    const alreadyChosen =
      typeof meta.variantId === 'string' && meta.variantId.trim().length > 0;
    if (alreadyChosen) return null;
    const startPlayerId =
      ownerId ?? players.find((p) => typeof p?.id === 'number')?.id ?? null;
    if (startPlayerId == null) return null;

    const candidateVariants = SAC_VARIANTS.map((variant) => ({
      id: variant.id,
      label: variant.label,
      summary: variant.summary,
    })).filter(
      (variant) =>
        typeof variant.id === 'string' &&
        variant.id.trim() &&
        typeof variant.label === 'string' &&
        variant.label.trim(),
    );
    if (!candidateVariants.length) return null;

    return this.setupFlow.createSequentialChoicePending({
      players,
      startPlayerId,
      isAssigned: () => alreadyChosen,
      pendingType: 'sac_variant_choice',
      choices: candidateVariants,
      labelForPlayer: (playerLabel) =>
        `C'est à ${playerLabel} de choisir la variante de Sac à Malices.`,
      dataBuilder: () => ({ variants: candidateVariants }),
    });
  }

  private buildConfiguredState(
    base: GameStateEntity,
    variantId: SacVariantId,
  ): GameStateEntity {
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

    const seedMeta = asRecord(base.metadata);
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
        chance: { cards: s1.values, discard: [] },
        community: { cards: s2.values, discard: [] },
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
        : this.resolveSeededStarterId(
            players,
            base.metadata ?? {},
            base.turn?.currentPlayerId ?? null,
          );

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

  private resolveSeededStarterId(
    players: Array<{ id: number }>,
    meta: unknown,
    fallbackId: number | null,
  ): number | null {
    if (!players.length) return fallbackId;
    if (
      typeof fallbackId === 'number' &&
      players.some((p) => p?.id === fallbackId)
    ) {
      return fallbackId;
    }
    const seed = ensureSeededRng((meta ?? {}) as Record<string, unknown>).seed;
    const shuffled = seededShuffle(
      players,
      seed,
      'sac-a-malices:setup-starter',
    );
    return shuffled[0]?.id ?? fallbackId ?? players[0]?.id ?? null;
  }

  private loadBoard(variant: SacVariantConfig): SacBoardJsonV1 {
    const contentDir = variant.contentDir;
    return loadV1Content<SacBoardJsonV1>(this.contentLoader, {
      gameType: variant.gameType,
      baseDir: __dirname,
      ...(contentDir ? { contentDir } : {}),
      filename: 'board.json',
      arrayField: 'tiles',
      minItems: 1,
    });
  }

  private loadGroups(variant: SacVariantConfig): SacGroupsJsonV1 {
    const contentDir = variant.contentDir;
    return loadV1Content<SacGroupsJsonV1>(this.contentLoader, {
      gameType: variant.gameType,
      baseDir: __dirname,
      ...(contentDir ? { contentDir } : {}),
      filename: 'groups.json',
      arrayField: 'groups',
      minItems: 1,
    });
  }

  private loadStations(variant: SacVariantConfig): SacStationsJsonV1 {
    const contentDir = variant.contentDir;
    return loadV1Content<SacStationsJsonV1>(this.contentLoader, {
      gameType: variant.gameType,
      baseDir: __dirname,
      ...(contentDir ? { contentDir } : {}),
      filename: 'stations.json',
      extraValidators: [
        this.contentLoader.validators.requiredFields('stations'),
      ],
    });
  }

  private loadUtilities(variant: SacVariantConfig): SacUtilitiesJsonV1 {
    const contentDir = variant.contentDir;
    return loadV1Content<SacUtilitiesJsonV1>(this.contentLoader, {
      gameType: variant.gameType,
      baseDir: __dirname,
      ...(contentDir ? { contentDir } : {}),
      filename: 'utilities.json',
      arrayField: 'utilities',
      minItems: variant.utilitiesMin,
    });
  }

  private loadCards(
    variant: SacVariantConfig,
    filename: string,
  ): SacCardsJsonV1 {
    const contentDir = variant.contentDir;
    return loadV1Content<SacCardsJsonV1>(this.contentLoader, {
      gameType: variant.gameType,
      baseDir: __dirname,
      ...(contentDir ? { contentDir } : {}),
      filename,
      arrayField: 'cards',
      minItems: 1,
    });
  }
}
