"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "CatPattesSetupService", {
    enumerable: true,
    get: function() {
        return CatPattesSetupService;
    }
});
const _common = require("@nestjs/common");
const _setupservicehelper = require("../../../../setup/setup-service.helper");
const _gamecoreservice = require("../../../../core/services/game-core.service");
const _randomservice = require("../../../../modules/random/services/random.service");
const _setupflowservice = require("../../../../modules/setup-flow/services/setup-flow.service");
const _catpattescards = require("../model/cat-pattes-cards");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let CatPattesSetupService = class CatPattesSetupService {
    hydrateInitialState(baseState) {
        const players = (0, _setupservicehelper.getSafePlayers)(baseState);
        const metaSeed = baseState.metadata ?? {};
        const rng = (0, _setupservicehelper.getRngMeta)(metaSeed);
        const deck = _catpattescards.CAT_PATTES_DECK.map((card)=>card.id);
        const { values: shuffledDeck, meta: updatedRng } = this.random.shuffle(rng, deck);
        const remainingDeck = [
            ...shuffledDeck
        ];
        const hands = {};
        const positions = {};
        const points = {
            ...metaSeed?.points ?? {}
        };
        const obstacles = {};
        const bots = {};
        const hasSun = {};
        const turboPlayed = {};
        const pawnByPlayerId = {};
        for (const player of players){
            if (!player?.id) continue;
            positions[player.id] = 0;
            if (typeof points[player.id] !== 'number') points[player.id] = 0;
            obstacles[player.id] = null;
            bots[player.id] = [];
            hasSun[player.id] = false;
            turboPlayed[player.id] = 0;
            const hand = [];
            for(let i = 0; i < 6; i += 1){
                if (!remainingDeck.length) break;
                hand.push(remainingDeck.shift());
            }
            hands[player.id] = hand;
        }
        const setupStarterId = typeof baseState.turn?.currentPlayerId === 'number' ? baseState.turn.currentPlayerId : players[0]?.id ?? null;
        const metadata = {
            rng: updatedRng,
            deck: remainingDeck,
            discard: [],
            hands,
            positions,
            points,
            obstacles,
            bots,
            turboPlayed,
            hasSun,
            pawns: [
                ..._catpattescards.CAT_PATTES_PAWNS
            ],
            pawnByPlayerId,
            setupStarterId,
            drawnPlayerId: null,
            winnerId: null
        };
        const usedForPending = new Set(Object.values(metadata.pawnByPlayerId ?? {}).filter((v)=>typeof v === 'string'));
        const choicesForPending = (metadata.pawns ?? []).filter((p)=>!usedForPending.has(p));
        const pendingInfo = this.setupFlow.createSequentialPawnPending({
            players,
            startPlayerId: setupStarterId,
            isAssigned: (playerId)=>{
                const player = players.find((p)=>p?.id === playerId);
                return Boolean(metadata.pawnByPlayerId?.[playerId]) || this.isBotLike(player);
            },
            pawns: choicesForPending.map((name)=>({
                    id: name,
                    label: name
                }))
        });
        const metadataWithBots = pendingInfo == null ? this.assignMissingBotPawns(players, metadata) : metadata;
        const next = {
            ...baseState,
            metadata: metadataWithBots,
            pending: pendingInfo?.pending ?? null,
            turnIndex: pendingInfo?.turnIndex != null ? pendingInfo.turnIndex : baseState.turnIndex,
            turn: {
                ...baseState.turn ?? {
                    direction: 1
                },
                currentPlayerId: pendingInfo?.playerId ?? setupStarterId,
                direction: 1
            }
        };
        return next;
    }
    assignMissingBotPawns(players, meta) {
        const assigned = {
            ...meta.pawnByPlayerId ?? {}
        };
        const used = new Set(Object.values(assigned).filter((v)=>typeof v === 'string' && v.trim().length > 0));
        const pool = Array.isArray(meta.pawns) ? meta.pawns.filter((pawn)=>!used.has(pawn)) : [];
        const shuffled = this.random.shuffle(meta, pool);
        const shuffledPool = Array.isArray(shuffled.values) ? shuffled.values : [];
        let pawnIndex = 0;
        for (const player of players){
            if (!player?.id || !this.isBotLike(player)) continue;
            if (assigned[player.id]) continue;
            const nextPawn = shuffledPool[pawnIndex];
            if (!nextPawn) break;
            assigned[player.id] = nextPawn;
            used.add(nextPawn);
            pawnIndex += 1;
        }
        return {
            ...meta,
            rng: shuffled.meta?.rng ?? meta.rng,
            pawnByPlayerId: assigned
        };
    }
    isBotLike(player) {
        if (!player) return false;
        if (player.isBot === true) return true;
        const username = String(player?.username ?? '').trim().toLowerCase();
        if (username.includes('bot')) return true;
        const kind = String(player?.kind ?? player?.type ?? '').trim().toLowerCase();
        return kind === 'bot' || kind === 'ai';
    }
    constructor(_core, random, setupFlow){
        this.random = random;
        this.setupFlow = setupFlow;
    }
};
CatPattesSetupService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _gamecoreservice.GameCoreService === "undefined" ? Object : _gamecoreservice.GameCoreService,
        typeof _randomservice.RandomService === "undefined" ? Object : _randomservice.RandomService,
        typeof _setupflowservice.SetupFlowService === "undefined" ? Object : _setupflowservice.SetupFlowService
    ])
], CatPattesSetupService);
