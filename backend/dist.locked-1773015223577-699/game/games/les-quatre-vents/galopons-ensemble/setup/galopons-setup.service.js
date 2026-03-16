"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "GaloponsSetupService", {
    enumerable: true,
    get: function() {
        return GaloponsSetupService;
    }
});
const _common = require("@nestjs/common");
const _gamecontentloaderservice = require("../../../../engine/services/game-content-loader.service");
const _randomservice = require("../../../../modules/random/services/random.service");
const _setupflowservice = require("../../../../modules/setup-flow/services/setup-flow.service");
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
const GALOPONS_PAWNS = [
    {
        id: 'shetland',
        name: 'Le Poney Shetland',
        description: "Petit, trapu et plein de malice, ce poney ressemble à une peluche... jusqu'au moment où il décide que c'est lui qui commande. Ne vous fiez pas à sa taille : c'est un véritable tracteur miniature avec un sacré caractère !"
    },
    {
        id: 'mustang',
        name: 'Le Mustang',
        description: `Ce cheval des grands espaces adore galoper librement comme s'il tournait dans un vieux western. Rapide, malin et un peu rebelle, il a toujours l'air de dire : "Attrape-moi si tu peux !"`
    },
    {
        id: 'percheron',
        name: 'Le Percheron',
        description: "Grand, puissant et impressionnant, ce cheval pourrait presque tirer une maison... ou au moins la caravane du voisin. Malgré sa taille de géant, il est souvent d'un calme olympien."
    },
    {
        id: 'camargue',
        name: 'Le Camargue',
        description: `Toujours prêt à patauger dans les marais, ce cheval blanc semble aimer l'eau presque autant qu'un canard. Rustique et courageux, il suit les taureaux avec l'air de dire : "Même pas peur !"`
    }
];
function asRecord(value) {
    return value != null && typeof value === 'object' ? value : {};
}
function toText(value) {
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    return '';
}
let GaloponsSetupService = class GaloponsSetupService {
    hydrateInitialState(base) {
        const board = this.loadBoard();
        const cards = this.loadCards();
        const pawns = this.loadPawns();
        const players = Array.isArray(base.players) ? base.players : [];
        const positions = {};
        const apples = {};
        for (const player of players){
            positions[player.id] = 0;
            apples[player.id] = 0;
        }
        const seedMeta = asRecord(base.metadata);
        const pawnByPlayerId = this.normalizePawnAssignments(players, seedMeta.pawnByPlayerId, pawns);
        const setupStarterId = typeof seedMeta.setupStarterId === 'number' ? seedMeta.setupStarterId : players[0]?.id ?? null;
        const shuffled = this.random.shuffle(seedMeta, cards.cards ?? []);
        const meta = {
            tiles: board.tiles ?? [],
            positions,
            apples,
            pawns,
            pawnByPlayerId,
            setupStarterId,
            ious: {},
            statuses: {
                skipTurn: {}
            },
            decks: {
                cards: shuffled.values,
                discard: []
            },
            pendingContext: null,
            finish: {
                triggered: false,
                starterId: null,
                pendingIds: [],
                bonusGiven: false
            },
            winnerId: null
        };
        const hydratedPlayers = players.map((player)=>{
            const pawnId = pawnByPlayerId[player.id];
            if (!pawnId) return player;
            const pawn = pawns.find((entry)=>entry.id === pawnId);
            if (!pawn) return player;
            return {
                ...player,
                pawn: pawn.id,
                pawnLabel: pawn.name
            };
        });
        const initial = {
            ...base,
            players: hydratedPlayers,
            phase: 'playing',
            pending: null,
            turn: {
                ...base.turn ?? {
                    currentPlayerId: setupStarterId,
                    direction: 1
                },
                currentPlayerId: setupStarterId,
                direction: 1
            },
            metadata: {
                ...base.metadata ?? {},
                ...shuffled.meta,
                ...meta
            }
        };
        const pendingInfo = this.setupFlow.createSequentialPawnPending({
            players: hydratedPlayers,
            startPlayerId: setupStarterId,
            isAssigned: (playerId)=>Boolean(pawnByPlayerId[playerId]),
            pawns: pawns.filter((pawn)=>!Object.values(pawnByPlayerId).includes(pawn.id)).map((pawn)=>({
                    id: pawn.id,
                    label: pawn.name,
                    description: pawn.description
                })),
            choiceLabelBuilder: (pawn)=>toText(pawn.description).length > 0 ? `${toText(pawn.label)}: ${toText(pawn.description)}` : toText(pawn.label),
            pawnDataMapper: (choice)=>({
                    id: toText(choice.id),
                    label: toText(choice.label),
                    description: toText(choice.description)
                })
        });
        if (!pendingInfo) {
            return initial;
        }
        return {
            ...initial,
            pending: pendingInfo.pending,
            turnIndex: pendingInfo.turnIndex,
            turn: {
                ...initial.turn ?? {
                    currentPlayerId: pendingInfo.playerId,
                    direction: 1
                },
                currentPlayerId: pendingInfo.playerId,
                direction: 1
            }
        };
    }
    loadBoard() {
        return (0, _contentloaderhelper.loadV1Content)(this.contentLoader, {
            gameType: 'galopons-ensemble',
            baseDir: __dirname,
            filename: 'board.json',
            arrayField: 'tiles',
            minItems: 1
        });
    }
    loadCards() {
        return (0, _contentloaderhelper.loadV1Content)(this.contentLoader, {
            gameType: 'galopons-ensemble',
            baseDir: __dirname,
            filename: 'cards.json',
            arrayField: 'cards',
            minItems: 1
        });
    }
    loadPawns() {
        return GALOPONS_PAWNS.map((pawn)=>({
                ...pawn
            }));
    }
    normalizePawnAssignments(players, raw, pawns) {
        const byId = {};
        if (!raw || typeof raw !== 'object') return byId;
        const rawRecord = asRecord(raw);
        const used = new Set();
        const choices = pawns.map((pawn)=>({
                id: pawn.id,
                label: pawn.name
            }));
        for (const player of players){
            const resolved = this.setupFlow.resolveChoice(rawRecord[String(player.id)], choices);
            const pawnId = toText(resolved?.id);
            if (!pawnId || used.has(pawnId)) continue;
            used.add(pawnId);
            byId[player.id] = pawnId;
        }
        return byId;
    }
    constructor(contentLoader, random, setupFlow){
        this.contentLoader = contentLoader;
        this.random = random;
        this.setupFlow = setupFlow;
    }
};
GaloponsSetupService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _gamecontentloaderservice.GameContentLoaderService === "undefined" ? Object : _gamecontentloaderservice.GameContentLoaderService,
        typeof _randomservice.RandomService === "undefined" ? Object : _randomservice.RandomService,
        typeof _setupflowservice.SetupFlowService === "undefined" ? Object : _setupflowservice.SetupFlowService
    ])
], GaloponsSetupService);
