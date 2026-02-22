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
exports.JeuOieSetupService = void 0;
const common_1 = require("@nestjs/common");
const setup_service_helper_1 = require("../../../../setup/setup-service.helper");
const game_core_service_1 = require("../../../../core/services/game-core.service");
const game_content_loader_service_1 = require("../../../../engine/services/game-content-loader.service");
const setup_flow_service_1 = require("../../../../modules/setup-flow/services/setup-flow.service");
const seeded_rng_1 = require("../../../../../common/utils/seeded-rng");
const seeded_shuffle_1 = require("../../../../../common/utils/seeded-shuffle");
const content_loader_helper_1 = require("../../../../setup/content-loader.helper");
const JEU_OIE_PAWNS = [
    { id: 'coq-rockeur', label: 'Coq rockeur', feminine: false },
    { id: 'vache-artistique', label: 'Vache artistique', feminine: true },
    { id: 'cochon-gourmand', label: 'Cochon gourmand', feminine: false },
    { id: 'poule-scientifique', label: 'Poule scientifique', feminine: true },
    { id: 'chevre-acrobate', label: 'Chèvre acrobate', feminine: true },
    { id: 'marmotte-reveuse', label: 'Marmotte rêveuse', feminine: true },
];
let JeuOieSetupService = class JeuOieSetupService {
    contentLoader;
    setupFlow;
    constructor(_core, contentLoader, setupFlow) {
        this.contentLoader = contentLoader;
        this.setupFlow = setupFlow;
    }
    loadTexts() {
        return (0, content_loader_helper_1.loadV1Content)(this.contentLoader, {
            gameType: 'jeu-oie',
            baseDir: __dirname,
            filename: 'descriptions.json',
            arrayField: 'cases',
            minItems: 1,
        });
    }
    hydrateInitialState(baseState) {
        const players = (0, setup_service_helper_1.getSafePlayers)(baseState);
        const positions = {};
        const laps = {};
        for (const p of players) {
            positions[p.id] = 1;
            laps[p.id] = 0;
        }
        const pawnByPlayerId = {};
        const starterId = resolveSeededStarterId(players, baseState.metadata ?? {}, typeof baseState.turn?.currentPlayerId === 'number'
            ? baseState.turn.currentPlayerId
            : null);
        const pendingInfo = this.setupFlow.createSequentialPawnPending({
            players,
            startPlayerId: starterId,
            isAssigned: (playerId) => Boolean(pawnByPlayerId[playerId]),
            pawns: JEU_OIE_PAWNS.map((pawn) => ({
                id: pawn.id,
                label: pawn.label,
                feminine: pawn.feminine,
            })),
            pawnDataMapper: (choice) => ({
                id: choice.id,
                label: choice.label,
                feminine: Boolean(choice?.feminine),
            }),
        });
        const meta = {
            tiles: buildTiles(this.loadTexts()),
            positions,
            laps,
            pawns: [...JEU_OIE_PAWNS],
            pawnByPlayerId,
            setupStarterId: starterId,
            statuses: { skipTurn: {}, well: {} },
            winnerId: null,
        };
        const next = {
            ...baseState,
            phase: 'turn',
            lastRoll: null,
            pending: pendingInfo?.pending ?? null,
            turnIndex: pendingInfo?.turnIndex != null
                ? pendingInfo.turnIndex
                : baseState.turnIndex,
            turn: {
                ...(baseState.turn ?? { direction: 1 }),
                currentPlayerId: pendingInfo?.playerId ?? starterId,
                direction: 1,
            },
            metadata: { ...(baseState.metadata ?? {}), ...meta },
        };
        return next;
    }
};
exports.JeuOieSetupService = JeuOieSetupService;
exports.JeuOieSetupService = JeuOieSetupService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [game_core_service_1.GameCoreService,
        game_content_loader_service_1.GameContentLoaderService,
        setup_flow_service_1.SetupFlowService])
], JeuOieSetupService);
function resolveSeededStarterId(players, meta, fallbackId) {
    if (!players.length)
        return fallbackId;
    const seed = (0, seeded_rng_1.ensureSeededRng)((meta ?? {})).seed;
    const shuffled = (0, seeded_shuffle_1.seededShuffle)(players, seed, 'jeu-oie:setup-starter');
    return shuffled[0]?.id ?? players[0]?.id ?? fallbackId;
}
function buildTiles(texts) {
    const byIndex = new Map();
    for (const c of texts?.cases ?? []) {
        const index = typeof c?.index === 'number' ? c.index : Number(c?.index);
        if (!Number.isFinite(index))
            continue;
        const title = typeof c?.title === 'string' ? c.title.trim() : '';
        const description = typeof c?.description === 'string' ? c.description.trim() : '';
        if (!title && !description)
            continue;
        byIndex.set(Math.trunc(index), { title, description });
    }
    const tiles = [];
    const goose = new Set([5, 9, 14, 18, 23, 27, 32, 36, 41, 45, 50, 54, 59]);
    for (let i = 0; i <= 63; i += 1) {
        if (i === 0) {
            tiles.push({
                id: 'outside',
                type: 'normal',
                label: 'Case 0 - Hors plateau',
            });
            continue;
        }
        if (i === 1) {
            const t = byIndex.get(i);
            tiles.push({
                id: 'start',
                type: 'start',
                label: t?.title ? `Case ${i} - ${t.title}` : `Case ${i} - Départ`,
                description: t?.description || undefined,
            });
            continue;
        }
        if (i === 63) {
            const t = byIndex.get(i);
            tiles.push({
                id: 'finish',
                type: 'finish',
                label: t?.title ? `Case ${i} - ${t.title}` : `Case ${i} - Arrivée`,
                description: t?.description || undefined,
            });
            continue;
        }
        if (i === 6) {
            const t = byIndex.get(i);
            tiles.push({
                id: 'bridge',
                type: 'bridge',
                label: t?.title ? `Case ${i} - ${t.title}` : `Case ${i} - Pont`,
                description: t?.description || undefined,
            });
            continue;
        }
        if (i === 19) {
            const t = byIndex.get(i);
            tiles.push({
                id: 'inn',
                type: 'inn',
                label: t?.title ? `Case ${i} - ${t.title}` : `Case ${i} - Auberge`,
                description: t?.description || undefined,
                skipTurns: 1,
            });
            continue;
        }
        if (i === 26) {
            const t = byIndex.get(i);
            tiles.push({
                id: 'magic-die',
                type: 'magic_die',
                label: t?.title ? `Case ${i} - ${t.title}` : `Case ${i} - Dé magique`,
                description: t?.description || undefined,
            });
            continue;
        }
        if (i === 31) {
            const t = byIndex.get(i);
            tiles.push({
                id: 'well',
                type: 'well',
                label: t?.title ? `Case ${i} - ${t.title}` : `Case ${i} - Puits`,
                description: t?.description || undefined,
            });
            continue;
        }
        if (i === 42) {
            const t = byIndex.get(i);
            tiles.push({
                id: 'labyrinth',
                type: 'labyrinth',
                label: t?.title ? `Case ${i} - ${t.title}` : `Case ${i} - Labyrinthe`,
                description: t?.description || undefined,
                backTo: 30,
            });
            continue;
        }
        if (i === 52) {
            const t = byIndex.get(i);
            tiles.push({
                id: 'prison',
                type: 'prison',
                label: t?.title ? `Case ${i} - ${t.title}` : `Case ${i} - Prison`,
                description: t?.description || undefined,
                skipTurns: 2,
            });
            continue;
        }
        if (i === 58) {
            const t = byIndex.get(i);
            tiles.push({
                id: 'death',
                type: 'death',
                label: t?.title ? `Case ${i} - ${t.title}` : `Case ${i} - Mort`,
                description: t?.description || undefined,
                backTo: 1,
            });
            continue;
        }
        if (goose.has(i)) {
            const t = byIndex.get(i);
            tiles.push({
                id: `goose-${i}`,
                type: 'goose',
                label: t?.title ? `Case ${i} - ${t.title}` : `Case ${i} - Oie`,
                description: t?.description || undefined,
            });
            continue;
        }
        const t = byIndex.get(i);
        tiles.push({
            id: `c${i}`,
            type: 'normal',
            label: t?.title ? `Case ${i} - ${t.title}` : `Case ${i}`,
            description: t?.description || undefined,
        });
    }
    return tiles;
}
//# sourceMappingURL=jeu-oie-setup.service.js.map