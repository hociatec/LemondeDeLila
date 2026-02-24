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
exports.MinuitSetupService = void 0;
const common_1 = require("@nestjs/common");
const game_core_service_1 = require("../../../../core/services/game-core.service");
const game_content_loader_service_1 = require("../../../../engine/services/game-content-loader.service");
const random_service_1 = require("../../../../modules/random/services/random.service");
const setup_flow_service_1 = require("../../../../modules/setup-flow/services/setup-flow.service");
const content_loader_helper_1 = require("../../../../setup/content-loader.helper");
const pawn_catalog_helper_1 = require("../../../../core/helpers/pawn-catalog.helper");
const DEFAULT_PAWNS = [
    'Le Lutin',
    'Le Bonhomme de Neige',
    'La Fée des Flocons',
    'Le Père Noël',
    'Le Renne',
    "Le Petit Bonhomme en Pain d'Épices",
];
let MinuitSetupService = class MinuitSetupService {
    contentLoader;
    random;
    setupFlow;
    constructor(_core, contentLoader, random, setupFlow) {
        this.contentLoader = contentLoader;
        this.random = random;
        this.setupFlow = setupFlow;
    }
    isBotLike(player) {
        const playerRecord = asRecord(player);
        if (playerRecord.isBot === true)
            return true;
        const id = Number(playerRecord.id);
        if (Number.isFinite(id) && id < 0)
            return true;
        const username = typeof playerRecord.username === 'string'
            ? playerRecord.username.toLowerCase()
            : '';
        return username.includes('bot');
    }
    hasPawnAssigned(player, meta) {
        const playerRecord = asRecord(player);
        const playerId = Number(playerRecord.id);
        if (!Number.isFinite(playerId))
            return false;
        const playerPawn = typeof playerRecord.pawn === 'string' ? playerRecord.pawn.trim() : '';
        if (playerPawn.length > 0)
            return true;
        const metaPawn = String((meta.pawns ?? {})[playerId] ?? '').trim();
        return metaPawn.length > 0;
    }
    hydrateInitialState(base) {
        const board = this.loadBoard();
        const cards = this.loadCards();
        const pawns = this.loadPawns();
        const players = Array.isArray(base.players) ? base.players : [];
        const positions = {};
        for (const p of players)
            positions[p.id] = 0;
        const botPlayerIds = Array.from(new Set(players
            .filter((p) => this.isBotLike(p))
            .map((p) => Number(p?.id))
            .filter((id) => Number.isFinite(id))));
        const seedMeta = (base.metadata ?? {});
        const shuffled = this.random.shuffle(seedMeta, cards.cards ?? []);
        const meta = {
            tiles: board.tiles ?? [],
            positions,
            botPlayerIds,
            starterPlayerId: typeof base.turn?.currentPlayerId === 'number'
                ? base.turn.currentPlayerId
                : null,
            starterTurnIndex: typeof base.turnIndex === 'number' ? base.turnIndex : null,
            starterRestoredAfterPawnSelection: false,
            pawnChoices: (0, pawn_catalog_helper_1.loadCanonicalPawns)(Array.isArray(pawns.pawns) ? pawns.pawns : []).map((pawn) => ({
                id: pawn.id,
                name: pawn.name,
                description: pawn.description,
            })),
            statuses: {
                skipTurn: {},
                ignoreNextMalus: {},
                ignoreNextSkip: {},
                forceDrawNextTurn: {},
                keepTurn: {},
            },
            decks: { cards: shuffled.values, discard: [] },
            pendingQuiz: null,
            pendingContext: null,
            winnerId: null,
        };
        const playersForPending = Array.isArray(base.players) ? base.players : [];
        const missingForPending = playersForPending.filter((p) => !!p && !this.isBotLike(p) && !this.hasPawnAssigned(p, meta));
        const pending = !missingForPending.length
            ? null
            : (this.setupFlow.createSequentialPawnPending({
                players: playersForPending,
                startPlayerId: playersForPending[0]?.id ?? null,
                isAssigned: (playerId) => {
                    const player = playersForPending.find((p) => p?.id === playerId);
                    return (!player ||
                        this.isBotLike(player) ||
                        this.hasPawnAssigned(player, meta));
                },
                pendingType: 'pick_pawn',
                pawns: (() => {
                    const taken = new Set(playersForPending
                        .map((p) => typeof p?.pawn === 'string' ? String(p.pawn).trim() : '')
                        .filter((pawn) => pawn.length > 0));
                    const entries = this.listPawnChoiceEntries(meta, pawns.pawns ?? []);
                    const available = entries.filter((entry) => !taken.has(entry.id));
                    const chosenEntries = available.length ? available : [...entries];
                    return chosenEntries.map((entry) => ({
                        id: entry.id,
                        label: entry.label,
                        description: entry.description,
                    }));
                })(),
                includeChoiceMapData: true,
                pawnDataMapper: (choice) => {
                    const choiceRecord = asRecord(choice);
                    return {
                        id: toText(choiceRecord.id).trim(),
                        label: toText(choiceRecord.label).trim(),
                        description: toText(choiceRecord.description).trim(),
                    };
                },
            })?.pending ?? null);
        const next = {
            ...base,
            phase: 'playing',
            pending,
            turn: pending?.playerId
                ? {
                    ...(base.turn ?? { direction: 1 }),
                    currentPlayerId: pending.playerId,
                    direction: 1,
                }
                : base.turn,
            metadata: {
                ...(base.metadata ?? {}),
                ...shuffled.meta,
                ...meta,
            },
        };
        return next;
    }
    listPawnChoiceEntries(meta, pawns) {
        const fromContent = Array.isArray(meta.pawnChoices)
            ? meta.pawnChoices
            : Array.isArray(pawns)
                ? pawns
                : [];
        if (fromContent.length) {
            return fromContent
                .map((pawn) => {
                const pawnRecord = asRecord(pawn);
                const id = toText(pawnRecord.id).trim();
                const name = toText(pawnRecord.name).trim();
                if (!id || !name)
                    return null;
                const description = toText(pawnRecord.description).trim();
                const label = description ? `${name}: ${description}` : name;
                return { id, label, description };
            })
                .filter(Boolean);
        }
        return DEFAULT_PAWNS.map((name) => ({
            id: name,
            label: name,
            description: '',
        }));
    }
    loadBoard() {
        return (0, content_loader_helper_1.loadV1Content)(this.contentLoader, {
            gameType: 'en-attendant-minuit',
            baseDir: __dirname,
            filename: 'board.json',
            arrayField: 'tiles',
            minItems: 1,
        });
    }
    loadCards() {
        return (0, content_loader_helper_1.loadV1Content)(this.contentLoader, {
            gameType: 'en-attendant-minuit',
            baseDir: __dirname,
            filename: 'cards.json',
            arrayField: 'cards',
            minItems: 1,
        });
    }
    loadPawns() {
        return (0, content_loader_helper_1.loadV1Content)(this.contentLoader, {
            gameType: 'en-attendant-minuit',
            baseDir: __dirname,
            filename: 'pawns.json',
            arrayField: 'pawns',
            minItems: 1,
        });
    }
};
exports.MinuitSetupService = MinuitSetupService;
exports.MinuitSetupService = MinuitSetupService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [game_core_service_1.GameCoreService,
        game_content_loader_service_1.GameContentLoaderService,
        random_service_1.RandomService,
        setup_flow_service_1.SetupFlowService])
], MinuitSetupService);
function asRecord(value) {
    return value && typeof value === 'object'
        ? value
        : {};
}
function toText(value) {
    if (typeof value === 'string')
        return value;
    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }
    return '';
}
//# sourceMappingURL=minuit-setup.service.js.map