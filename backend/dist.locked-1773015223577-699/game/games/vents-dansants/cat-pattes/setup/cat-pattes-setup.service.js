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
const _catpattescards = require("../model/cat-pattes-cards");
const _catpattesstateentity = require("../model/cat-pattes-state.entity");
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
        const baseMetadata = baseState.metadata ?? {};
        const metaSeed = baseMetadata;
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
        const sunReady = {};
        const obstacleLock = {};
        const turboPlayed = {};
        const pawnByPlayerId = {};
        for (const player of players){
            if (!player?.id) continue;
            positions[player.id] = 0;
            if (typeof points[player.id] !== 'number') points[player.id] = 0;
            obstacles[player.id] = null;
            bots[player.id] = [];
            hasSun[player.id] = false;
            sunReady[player.id] = true;
            obstacleLock[player.id] = false;
            turboPlayed[player.id] = 0;
            const hand = [];
            for(let i = 0; i < 6; i += 1){
                if (!remainingDeck.length) break;
                hand.push(remainingDeck.shift());
            }
            hands[player.id] = hand;
        }
        const setupStarterId = typeof baseState.turn?.currentPlayerId === 'number' ? baseState.turn.currentPlayerId : players[0]?.id ?? null;
        const ownerPlayerId = this.resolveOwnerPlayerId(players, baseMetadata) ?? setupStarterId;
        const roundsToPlay = this.resolveRoundsToPlay(metaSeed?.roundsToPlay);
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
            sunReady,
            obstacleLock,
            pawns: [
                ..._catpattescards.CAT_PATTES_PAWNS
            ],
            pawnByPlayerId,
            setupStep: 'setup_config',
            ownerPlayerId,
            goalPattes: _catpattesstateentity.CAT_PATTES_GOAL,
            roundsToPlay,
            completedRounds: 0,
            setupStarterId,
            drawnPlayerId: null,
            winnerId: null
        };
        const next = {
            ...baseState,
            metadata,
            pending: {
                type: 'config_prompt',
                playerId: ownerPlayerId,
                blocking: true,
                label: 'Configuration Cat Pattes.',
                choices: [],
                data: {
                    title: 'Cat Pattes !',
                    actionType: 'cat_pattes_set_config',
                    fields: [
                        {
                            key: 'roundsToPlay',
                            label: 'Nombre de manches',
                            kind: 'number',
                            min: 1,
                            max: 20,
                            initialText: String(roundsToPlay)
                        }
                    ]
                }
            },
            turnIndex: baseState.turnIndex,
            turn: {
                ...baseState.turn ?? {
                    direction: 1
                },
                currentPlayerId: ownerPlayerId ?? setupStarterId,
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
    resolveOwnerPlayerId(players, metadata) {
        const pickFirstHuman = ()=>{
            const human = players.find((p)=>p?.id != null && p.isBot !== true);
            return typeof human?.id === 'number' ? human.id : null;
        };
        const ownerRaw = typeof metadata?.ownerPlayerId === 'number' ? metadata.ownerPlayerId : typeof metadata?.roomOwnerId === 'number' ? metadata.roomOwnerId : null;
        if (typeof ownerRaw === 'number' && players.some((p)=>Number(p?.id) === ownerRaw && p?.isBot !== true)) {
            return ownerRaw;
        }
        return pickFirstHuman() ?? players[0]?.id ?? null;
    }
    resolveRoundsToPlay(value) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return _catpattesstateentity.CAT_PATTES_DEFAULT_ROUNDS;
        const rounded = Math.round(parsed);
        if (rounded < 1 || rounded > 20) return _catpattesstateentity.CAT_PATTES_DEFAULT_ROUNDS;
        return rounded;
    }
    constructor(_core, random){
        this.random = random;
    }
};
CatPattesSetupService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _gamecoreservice.GameCoreService === "undefined" ? Object : _gamecoreservice.GameCoreService,
        typeof _randomservice.RandomService === "undefined" ? Object : _randomservice.RandomService
    ])
], CatPattesSetupService);
