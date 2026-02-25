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
exports.FrousseSetupService = void 0;
const common_1 = require("@nestjs/common");
const game_content_loader_service_1 = require("../../../../engine/services/game-content-loader.service");
const random_service_1 = require("../../../../modules/random/services/random.service");
const setup_flow_service_1 = require("../../../../modules/setup-flow/services/setup-flow.service");
const pawn_catalog_helper_1 = require("../../../../core/helpers/pawn-catalog.helper");
const content_loader_helper_1 = require("../../../../setup/content-loader.helper");
let FrousseSetupService = class FrousseSetupService {
    contentLoader;
    random;
    setupFlow;
    constructor(contentLoader, random, setupFlow) {
        this.contentLoader = contentLoader;
        this.random = random;
        this.setupFlow = setupFlow;
    }
    hydrateInitialState(base) {
        const board = this.loadBoard();
        const cards = this.loadCards();
        const pawns = this.loadPawns();
        const players = Array.isArray(base.players) ? base.players : [];
        const positions = {};
        for (const p of players)
            positions[p.id] = 0;
        const seedMeta = asRecord(base.metadata);
        const shuffled = this.random.shuffle(seedMeta, cards.cards ?? []);
        const meta = {
            tiles: board.tiles ?? [],
            positions,
            statuses: {
                skipTurn: {},
                ignoreNextTrap: {},
                ignoreTrapUntilNextDraw: {},
                ignoreNextPrank: {},
                ignoreNextGhost: {},
                nextMoveCap: {},
                nextRollMalus: {},
                nextRollKeepLowest: {},
                nextRollDouble: {},
                nextRollIfThreeBackTwo: {},
                blocked: {},
            },
            decks: { cards: shuffled.values, discard: [] },
            pawns: (0, pawn_catalog_helper_1.loadCanonicalPawns)(Array.isArray(pawns.pawns) ? pawns.pawns : []).map((pawn) => ({
                id: pawn.id,
                name: pawn.name,
                description: pawn.description,
            })),
            pendingContext: null,
            winnerId: null,
        };
        const baseMetadata = (base.metadata ?? {});
        const initial = {
            ...base,
            phase: 'playing',
            pending: null,
            metadata: {
                ...baseMetadata,
                ...shuffled.meta,
                ...meta,
            },
        };
        const pendingInfo = this.setupFlow.createSequentialPawnPending({
            players,
            startPlayerId: players[0]?.id ?? null,
            isAssigned: (playerId) => {
                const player = players.find((p) => p?.id === playerId);
                return String(player?.pawn ?? '').trim().length > 0;
            },
            pawns: (Array.isArray(meta.pawns) ? meta.pawns : [])
                .map((p) => ({
                id: toText(p?.id),
                label: toText(p?.name) || toText(p?.id),
                description: toText(p?.description),
            }))
                .filter((p) => p.id.length > 0),
            pawnDataMapper: (choice) => ({
                id: toText(choice.id),
                label: toText(choice.label),
                description: toText(choice.description),
            }),
            extraPendingData: { kind: 'choose_pawn' },
        });
        if (!pendingInfo)
            return initial;
        return {
            ...initial,
            pending: pendingInfo.pending,
            turnIndex: pendingInfo.turnIndex,
            turn: {
                ...(base.turn ?? {
                    currentPlayerId: pendingInfo.playerId,
                    direction: 1,
                }),
                currentPlayerId: pendingInfo.playerId,
                direction: base.turn?.direction === -1 ? -1 : 1,
            },
        };
    }
    loadBoard() {
        return (0, content_loader_helper_1.loadV1Content)(this.contentLoader, {
            gameType: 'frousse-party',
            baseDir: __dirname,
            filename: 'board.json',
            arrayField: 'tiles',
            minItems: 1,
        });
    }
    loadCards() {
        return (0, content_loader_helper_1.loadV1Content)(this.contentLoader, {
            gameType: 'frousse-party',
            baseDir: __dirname,
            filename: 'cards.json',
            arrayField: 'cards',
            minItems: 1,
        });
    }
    loadPawns() {
        return (0, content_loader_helper_1.loadV1Content)(this.contentLoader, {
            gameType: 'frousse-party',
            baseDir: __dirname,
            filename: 'pawns.json',
            arrayField: 'pawns',
            minItems: 1,
        });
    }
};
exports.FrousseSetupService = FrousseSetupService;
exports.FrousseSetupService = FrousseSetupService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [game_content_loader_service_1.GameContentLoaderService,
        random_service_1.RandomService,
        setup_flow_service_1.SetupFlowService])
], FrousseSetupService);
function asRecord(value) {
    return value && typeof value === 'object'
        ? value
        : {};
}
function toText(value) {
    if (typeof value === 'string')
        return value.trim();
    if (typeof value === 'number' && Number.isFinite(value))
        return String(value);
    if (typeof value === 'boolean')
        return value ? 'true' : 'false';
    return '';
}
//# sourceMappingURL=frousse-setup.service.js.map