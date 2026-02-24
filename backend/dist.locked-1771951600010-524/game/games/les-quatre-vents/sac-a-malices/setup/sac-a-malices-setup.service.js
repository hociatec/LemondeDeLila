"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SacAMalicesSetupService = void 0;
const common_1 = require("@nestjs/common");
const game_content_loader_service_1 = require("../../../../engine/services/game-content-loader.service");
const random_service_1 = require("../../../../modules/random/services/random.service");
const setup_flow_service_1 = require("../../../../modules/setup-flow/services/setup-flow.service");
const content_loader_helper_1 = require("../../../../setup/content-loader.helper");
const seeded_rng_1 = require("../../../../../common/utils/seeded-rng");
const seeded_shuffle_1 = require("../../../../../common/utils/seeded-shuffle");
const sac_a_malices_variants_1 = require("../sac-a-malices-variants");
function asRecord(value) {
    return value != null && typeof value === 'object'
        ? value
        : {};
}
function toNumber(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
let SacAMalicesSetupService = class SacAMalicesSetupService {
    contentLoader;
    random;
    setupFlow;
    constructor(contentLoader, random, setupFlow) {
        this.contentLoader = contentLoader;
        this.random = random;
        this.setupFlow = setupFlow;
    }
    hydrateInitialState(base) {
        const meta = (base.metadata ?? {});
        const variantId = this.resolveVariantId(meta?.variantId);
        if (!variantId) {
            return this.buildSetupState(base);
        }
        return this.buildConfiguredState(base, variantId);
    }
    applyVariantSelection(base, variantId) {
        return this.buildConfiguredState(base, variantId);
    }
    resolveVariantId(raw) {
        const parsed = (0, sac_a_malices_variants_1.parseVariantInput)(raw);
        if (parsed && sac_a_malices_variants_1.SAC_VARIANT_BY_ID[parsed])
            return parsed;
        return null;
    }
    buildSetupState(base) {
        const players = Array.isArray(base.players) ? base.players : [];
        const meta = (base.metadata ?? {});
        const metaRecord = asRecord(meta);
        const ownerId = toNumber(metaRecord.ownerPlayerId) ?? players[0]?.id ?? null;
        const starterId = typeof meta.setupStarterId === 'number'
            ? meta.setupStarterId
            : this.resolveSeededStarterId(players, base.metadata ?? {}, base.turn?.currentPlayerId ?? null);
        const pendingInfo = this.buildVariantChoicePending(players, ownerId, meta);
        const pending = pendingInfo?.pending ?? null;
        const currentPlayerId = pendingInfo?.playerId ?? ownerId ?? base.turn?.currentPlayerId ?? null;
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
            },
        };
    }
    buildVariantChoicePending(players, ownerId, meta) {
        if (!players.length)
            return null;
        const alreadyChosen = typeof meta.variantId === 'string' && meta.variantId.trim().length > 0;
        if (alreadyChosen)
            return null;
        const startPlayerId = ownerId ?? players.find((p) => typeof p?.id === 'number')?.id ?? null;
        if (startPlayerId == null)
            return null;
        const candidateVariants = sac_a_malices_variants_1.SAC_VARIANTS.map((variant) => ({
            id: variant.id,
            label: variant.label,
            summary: variant.summary,
        })).filter((variant) => typeof variant.id === 'string' &&
            variant.id.trim() &&
            typeof variant.label === 'string' &&
            variant.label.trim());
        if (!candidateVariants.length)
            return null;
        return this.setupFlow.createSequentialChoicePending({
            players,
            startPlayerId,
            isAssigned: () => alreadyChosen,
            pendingType: 'sac_variant_choice',
            choices: candidateVariants,
            labelForPlayer: (playerLabel) => `C'est à ${playerLabel} de choisir la variante de Sac à Malices.`,
            dataBuilder: () => ({ variants: candidateVariants }),
        });
    }
    buildConfiguredState(base, variantId) {
        const variant = sac_a_malices_variants_1.SAC_VARIANT_BY_ID[variantId] ?? sac_a_malices_variants_1.SAC_VARIANTS[0];
        const board = this.loadBoard(variant);
        const groups = this.loadGroups(variant);
        const stations = this.loadStations(variant);
        const utilities = this.loadUtilities(variant);
        const chance = this.loadCards(variant, 'chance-cards.json');
        const community = this.loadCards(variant, 'community-cards.json');
        const players = Array.isArray(base.players) ? base.players : [];
        const positions = {};
        const money = {};
        const startMoney = Number(variant.rules.startMoney ?? 0) || 0;
        for (const p of players) {
            positions[p.id] = 0;
            money[p.id] = startMoney;
        }
        const seedMeta = asRecord(base.metadata);
        const s1 = this.random.shuffle(seedMeta, chance.cards ?? []);
        const s2 = this.random.shuffle(s1.meta, community.cards ?? []);
        const meta = {
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
        const metaBase = (base.metadata ?? {});
        const starterId = typeof metaBase.setupStarterId === 'number'
            ? metaBase.setupStarterId
            : this.resolveSeededStarterId(players, base.metadata ?? {}, base.turn?.currentPlayerId ?? null);
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
    resolveSeededStarterId(players, meta, fallbackId) {
        if (!players.length)
            return fallbackId;
        if (typeof fallbackId === 'number' &&
            players.some((p) => p?.id === fallbackId)) {
            return fallbackId;
        }
        const seed = (0, seeded_rng_1.ensureSeededRng)((meta ?? {})).seed;
        const shuffled = (0, seeded_shuffle_1.seededShuffle)(players, seed, 'sac-a-malices:setup-starter');
        return shuffled[0]?.id ?? fallbackId ?? players[0]?.id ?? null;
    }
    loadBoard(variant) {
        const contentDir = variant.contentDir;
        return (0, content_loader_helper_1.loadV1Content)(this.contentLoader, {
            gameType: variant.gameType,
            baseDir: __dirname,
            ...(contentDir ? { contentDir } : {}),
            filename: 'board.json',
            arrayField: 'tiles',
            minItems: 1,
        });
    }
    loadGroups(variant) {
        const contentDir = variant.contentDir;
        return (0, content_loader_helper_1.loadV1Content)(this.contentLoader, {
            gameType: variant.gameType,
            baseDir: __dirname,
            ...(contentDir ? { contentDir } : {}),
            filename: 'groups.json',
            arrayField: 'groups',
            minItems: 1,
        });
    }
    loadStations(variant) {
        const contentDir = variant.contentDir;
        return (0, content_loader_helper_1.loadV1Content)(this.contentLoader, {
            gameType: variant.gameType,
            baseDir: __dirname,
            ...(contentDir ? { contentDir } : {}),
            filename: 'stations.json',
            extraValidators: [
                this.contentLoader.validators.requiredFields('stations'),
            ],
        });
    }
    loadUtilities(variant) {
        const contentDir = variant.contentDir;
        return (0, content_loader_helper_1.loadV1Content)(this.contentLoader, {
            gameType: variant.gameType,
            baseDir: __dirname,
            ...(contentDir ? { contentDir } : {}),
            filename: 'utilities.json',
            arrayField: 'utilities',
            minItems: variant.utilitiesMin,
        });
    }
    loadCards(variant, filename) {
        const contentDir = variant.contentDir;
        return (0, content_loader_helper_1.loadV1Content)(this.contentLoader, {
            gameType: variant.gameType,
            baseDir: __dirname,
            ...(contentDir ? { contentDir } : {}),
            filename,
            arrayField: 'cards',
            minItems: 1,
        });
    }
};
exports.SacAMalicesSetupService = SacAMalicesSetupService;
exports.SacAMalicesSetupService = SacAMalicesSetupService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [game_content_loader_service_1.GameContentLoaderService,
        random_service_1.RandomService,
        setup_flow_service_1.SetupFlowService])
], SacAMalicesSetupService);
//# sourceMappingURL=sac-a-malices-setup.service.js.map