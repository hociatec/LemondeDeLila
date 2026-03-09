"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "JeuOieSetupService", {
    enumerable: true,
    get: function() {
        return JeuOieSetupService;
    }
});
const _common = require("@nestjs/common");
const _setupservicehelper = require("../../../../setup/setup-service.helper");
const _gamecoreservice = require("../../../../core/services/game-core.service");
const _gamecontentloaderservice = require("../../../../engine/services/game-content-loader.service");
const _setupflowservice = require("../../../../modules/setup-flow/services/setup-flow.service");
const _seededrng = require("../../../../../common/utils/seeded-rng");
const _seededshuffle = require("../../../../../common/utils/seeded-shuffle");
const _contentloaderhelper = require("../../../../setup/content-loader.helper");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
const JEU_OIE_PAWNS = [
    {
        id: 'coq-rockeur',
        label: 'Coq rockeur',
        feminine: false
    },
    {
        id: 'vache-artistique',
        label: 'Vache artistique',
        feminine: true
    },
    {
        id: 'cochon-gourmand',
        label: 'Cochon gourmand',
        feminine: false
    },
    {
        id: 'poule-scientifique',
        label: 'Poule scientifique',
        feminine: true
    },
    {
        id: 'chevre-acrobate',
        label: 'Chèvre acrobate',
        feminine: true
    },
    {
        id: 'marmotte-reveuse',
        label: 'Marmotte rêveuse',
        feminine: true
    }
];
let JeuOieSetupService = class JeuOieSetupService {
    loadTexts() {
        return (0, _contentloaderhelper.loadV1Content)(this.contentLoader, {
            gameType: 'jeu-oie',
            baseDir: __dirname,
            filename: 'descriptions.json',
            arrayField: 'cases',
            minItems: 1
        });
    }
    hydrateInitialState(baseState) {
        const players = (0, _setupservicehelper.getSafePlayers)(baseState);
        const positions = {};
        const laps = {};
        for (const p of players){
            positions[p.id] = 1;
            laps[p.id] = 0;
        }
        const pawnByPlayerId = {};
        const starterId = resolveSeededStarterId(players, baseState.metadata ?? {}, typeof baseState.turn?.currentPlayerId === 'number' ? baseState.turn.currentPlayerId : null);
        const pendingInfo = this.setupFlow.createSequentialPawnPending({
            players,
            startPlayerId: starterId,
            isAssigned: (playerId)=>Boolean(pawnByPlayerId[playerId]),
            pawns: JEU_OIE_PAWNS.map((pawn)=>({
                    id: pawn.id,
                    label: pawn.label,
                    feminine: pawn.feminine
                })),
            pawnDataMapper: (choice)=>({
                    id: choice.id,
                    label: choice.label,
                    feminine: Boolean(choice?.feminine)
                })
        });
        const meta = {
            tiles: buildTiles(this.loadTexts()),
            positions,
            laps,
            pawns: [
                ...JEU_OIE_PAWNS
            ],
            pawnByPlayerId,
            setupStarterId: starterId,
            statuses: {
                skipTurn: {},
                well: {}
            },
            winnerId: null
        };
        const next = {
            ...baseState,
            phase: 'turn',
            lastRoll: null,
            pending: pendingInfo?.pending ?? null,
            turnIndex: pendingInfo?.turnIndex != null ? pendingInfo.turnIndex : baseState.turnIndex,
            turn: {
                ...baseState.turn ?? {
                    direction: 1
                },
                currentPlayerId: pendingInfo?.playerId ?? starterId,
                direction: 1
            },
            metadata: {
                ...baseState.metadata ?? {},
                ...meta
            }
        };
        return next;
    }
    constructor(_core, contentLoader, setupFlow){
        this.contentLoader = contentLoader;
        this.setupFlow = setupFlow;
    }
};
JeuOieSetupService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _gamecoreservice.GameCoreService === "undefined" ? Object : _gamecoreservice.GameCoreService,
        typeof _gamecontentloaderservice.GameContentLoaderService === "undefined" ? Object : _gamecontentloaderservice.GameContentLoaderService,
        typeof _setupflowservice.SetupFlowService === "undefined" ? Object : _setupflowservice.SetupFlowService
    ])
], JeuOieSetupService);
function resolveSeededStarterId(players, meta, fallbackId) {
    if (!players.length) return fallbackId;
    const seed = (0, _seededrng.ensureSeededRng)(meta ?? {}).seed;
    const shuffled = (0, _seededshuffle.seededShuffle)(players, seed, 'jeu-oie:setup-starter');
    return shuffled[0]?.id ?? players[0]?.id ?? fallbackId;
}
function buildTiles(texts) {
    const byIndex = new Map();
    for (const c of texts?.cases ?? []){
        const index = typeof c?.index === 'number' ? c.index : Number(c?.index);
        if (!Number.isFinite(index)) continue;
        const title = typeof c?.title === 'string' ? c.title.trim() : '';
        const description = typeof c?.description === 'string' ? c.description.trim() : '';
        if (!title && !description) continue;
        byIndex.set(Math.trunc(index), {
            title,
            description
        });
    }
    const tiles = [];
    const goose = new Set([
        5,
        9,
        14,
        18,
        23,
        27,
        32,
        36,
        41,
        45,
        50,
        54,
        59
    ]);
    // 0..63 inclus (64 cases). Victoire = case 63.
    for(let i = 0; i <= 63; i += 1){
        if (i === 0) {
            tiles.push({
                id: 'outside',
                type: 'normal',
                label: 'Case 0 - Hors plateau'
            });
            continue;
        }
        if (i === 1) {
            const t = byIndex.get(i);
            tiles.push({
                id: 'start',
                type: 'start',
                label: t?.title ? `Case ${i} - ${t.title}` : `Case ${i} - Départ`,
                description: t?.description || undefined
            });
            continue;
        }
        if (i === 63) {
            const t = byIndex.get(i);
            tiles.push({
                id: 'finish',
                type: 'finish',
                label: t?.title ? `Case ${i} - ${t.title}` : `Case ${i} - Arrivée`,
                description: t?.description || undefined
            });
            continue;
        }
        if (i === 6) {
            const t = byIndex.get(i);
            tiles.push({
                id: 'bridge',
                type: 'bridge',
                label: t?.title ? `Case ${i} - ${t.title}` : `Case ${i} - Pont`,
                description: t?.description || undefined
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
                skipTurns: 1
            });
            continue;
        }
        if (i === 26) {
            const t = byIndex.get(i);
            tiles.push({
                id: 'magic-die',
                type: 'magic_die',
                label: t?.title ? `Case ${i} - ${t.title}` : `Case ${i} - Dé magique`,
                description: t?.description || undefined
            });
            continue;
        }
        if (i === 31) {
            const t = byIndex.get(i);
            tiles.push({
                id: 'well',
                type: 'well',
                label: t?.title ? `Case ${i} - ${t.title}` : `Case ${i} - Puits`,
                description: t?.description || undefined
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
                backTo: 30
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
                skipTurns: 2
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
                backTo: 1
            });
            continue;
        }
        if (goose.has(i)) {
            const t = byIndex.get(i);
            tiles.push({
                id: `goose-${i}`,
                type: 'goose',
                label: t?.title ? `Case ${i} - ${t.title}` : `Case ${i} - Oie`,
                description: t?.description || undefined
            });
            continue;
        }
        const t = byIndex.get(i);
        tiles.push({
            id: `c${i}`,
            type: 'normal',
            label: t?.title ? `Case ${i} - ${t.title}` : `Case ${i}`,
            description: t?.description || undefined
        });
    }
    return tiles;
}
