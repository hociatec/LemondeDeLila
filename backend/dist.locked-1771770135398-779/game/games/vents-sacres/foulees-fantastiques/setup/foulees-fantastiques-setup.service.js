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
exports.FouleesFantastiquesSetupService = void 0;
const common_1 = require("@nestjs/common");
const setup_service_helper_1 = require("../../../../setup/setup-service.helper");
const content_loader_helper_1 = require("../../../../setup/content-loader.helper");
const game_core_service_1 = require("../../../../core/services/game-core.service");
const game_content_loader_service_1 = require("../../../../engine/services/game-content-loader.service");
const setup_flow_service_1 = require("../../../../modules/setup-flow/services/setup-flow.service");
const family_definition_1 = require("../definitions/family.definition");
let FouleesFantastiquesSetupService = class FouleesFantastiquesSetupService {
    core;
    contentLoader;
    setupFlow;
    constructor(core, contentLoader, setupFlow) {
        this.core = core;
        this.contentLoader = contentLoader;
        this.setupFlow = setupFlow;
    }
    loadBoard() {
        return (0, content_loader_helper_1.loadV1Content)(this.contentLoader, {
            gameType: 'foulees-fantastiques',
            baseDir: __dirname,
            filename: 'board.json',
            arrayField: 'tiles',
            minItems: 1,
            extraValidators: [
                this.contentLoader.validators.positiveNumber('trackLength'),
                this.contentLoader.validators.positiveNumber('homeLength'),
            ],
        });
    }
    hydrateInitialState(baseState) {
        const players = (0, setup_service_helper_1.getSafePlayers)(baseState);
        const board = this.loadBoard();
        const trackLength = Number(board.trackLength);
        const homeLength = Number(board.homeLength);
        const pawnsByPlayer = {};
        const colorsByPlayer = {};
        const familyByPlayer = {};
        const habitatByPlayer = {};
        const pawnNamesByPlayer = {};
        const offsets = {};
        const half = Math.floor(trackLength / 2);
        const quarter = Math.floor(trackLength / 4);
        const threeQuarter = Math.floor((trackLength * 3) / 4);
        const offsetTable = [0, half, quarter, threeQuarter];
        const colorTable = [
            'Rouge',
            'Bleu',
            'Vert',
            'Jaune',
        ];
        players.forEach((p, idx) => {
            pawnsByPlayer[p.id] = Array.from({ length: 4 }).map((_, pawnIndex) => ({
                pawnIndex,
                progress: -1,
            }));
            colorsByPlayer[p.id] = colorTable[idx] ?? 'Rouge';
            offsets[p.id] = offsetTable[idx] ?? (idx * 10) % trackLength;
        });
        const tiles = Array.isArray(board.tiles)
            ? board.tiles.map((t, i) => ({
                id: String(t?.id ?? `c${i}`),
                type: 'normal',
                label: typeof t?.label === 'string' && t.label.trim()
                    ? t.label.trim()
                    : i === 0
                        ? 'Départ'
                        : `Case ${i + 1}`,
            }))
            : [];
        const safeTiles = Array.isArray(board.safeTiles) && board.safeTiles.length > 0
            ? board.safeTiles
                .map((v) => (typeof v === 'number' ? v : Number(v)))
                .filter((v) => Number.isFinite(v))
                .map((v) => Math.max(0, Math.min(trackLength - 1, v)))
            : [];
        const safeFromOffsets = players
            .map((p) => offsets[p.id])
            .filter((x) => typeof x === 'number');
        const mergedSafeTiles = Array.from(new Set([...safeTiles, ...safeFromOffsets]));
        const meta = {
            tiles,
            trackLength,
            homeLength,
            pawnsByPlayer,
            colorsByPlayer,
            familyIdByPlayer: {},
            familyByPlayer,
            habitatByPlayer,
            pawnNamesByPlayer,
            offsets,
            safeTiles: mergedSafeTiles,
            positions: {},
            laps: {},
            statuses: { skipTurn: {} },
            winnerId: null,
        };
        const hydrated = {
            ...baseState,
            phase: 'setup',
            lastRoll: null,
            pending: null,
            metadata: { ...(baseState.metadata ?? {}), ...meta },
        };
        const withBoard = this.recomputeBoardView(hydrated);
        const currentId = withBoard.turn?.currentPlayerId ?? players[0]?.id ?? null;
        if (currentId == null) {
            return withBoard;
        }
        const familyChoices = family_definition_1.FOULEES_FAMILY_PACKS.map(family_definition_1.toFouleesFamilyChoice);
        const withPending = {
            ...withBoard,
            pending: this.setupFlow.createSequentialChoicePending({
                players,
                startPlayerId: currentId,
                isAssigned: () => false,
                pendingType: 'choose_family',
                choices: familyChoices,
                labelForPlayer: () => family_definition_1.FOULEES_FAMILY_PENDING_LABEL,
                dataBuilder: (choices) => ({
                    familyIds: choices.map((c) => c.id),
                }),
            })?.pending,
        };
        const currentName = players.find((p) => p?.id === currentId)?.username?.trim() ||
            `Joueur ${currentId}`;
        return this.core.appendLog(withPending, `${currentName} doit choisir une famille d'animaux.`);
    }
    recomputeBoardView(state) {
        const meta = (state.metadata ?? {});
        const players = Array.isArray(state.players) ? state.players : [];
        const positions = {};
        const laps = {};
        for (const p of players) {
            const pawns = Array.isArray(meta.pawnsByPlayer?.[p.id])
                ? meta.pawnsByPlayer[p.id]
                : [];
            const onTrack = pawns
                .map((pawn) => typeof pawn?.progress === 'number' ? pawn.progress : -1)
                .filter((prog) => prog >= 0 && prog < meta.trackLength);
            if (onTrack.length) {
                const bestProg = Math.max(...onTrack);
                const offset = meta.offsets?.[p.id] ?? 0;
                positions[p.id] = (offset + bestProg) % meta.trackLength;
            }
            laps[p.id] = 0;
        }
        const updated = { ...meta, positions, laps };
        return { ...state, metadata: { ...(state.metadata ?? {}), ...updated } };
    }
};
exports.FouleesFantastiquesSetupService = FouleesFantastiquesSetupService;
exports.FouleesFantastiquesSetupService = FouleesFantastiquesSetupService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [game_core_service_1.GameCoreService,
        game_content_loader_service_1.GameContentLoaderService,
        setup_flow_service_1.SetupFlowService])
], FouleesFantastiquesSetupService);
//# sourceMappingURL=foulees-fantastiques-setup.service.js.map