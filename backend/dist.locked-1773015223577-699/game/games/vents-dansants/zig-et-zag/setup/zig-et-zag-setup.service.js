"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "ZigEtZagSetupService", {
    enumerable: true,
    get: function() {
        return ZigEtZagSetupService;
    }
});
const _common = require("@nestjs/common");
const _setupservicehelper = require("../../../../setup/setup-service.helper");
const _randomservice = require("../../../../modules/random/services/random.service");
const _zigetzagcards = require("../model/zig-et-zag-cards");
const _roundstatehelper = require("../round-state.helper");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let ZigEtZagSetupService = class ZigEtZagSetupService {
    hydrateInitialState(baseState) {
        const players = (0, _setupservicehelper.getSafePlayers)(baseState);
        const metaSeed = baseState.metadata ?? {};
        const rng = (0, _setupservicehelper.getRngMeta)(metaSeed);
        const deck = _zigetzagcards.ZIG_ET_ZAG_DECK.map((card)=>card.id);
        const { values: shuffledDeck, meta: updatedRng } = this.random.shuffle(rng, deck);
        const activePlayers = players.filter((player)=>typeof player?.id === 'number');
        const playerIds = activePlayers.map((player)=>player.id);
        const playerDecks = {};
        for (const pid of playerIds){
            playerDecks[pid] = [];
        }
        let dealIndex = 0;
        for (const cardId of shuffledDeck){
            if (!playerIds.length) break;
            const pid = playerIds[dealIndex % playerIds.length];
            playerDecks[pid] = [
                ...playerDecks[pid] ?? [],
                cardId
            ];
            dealIndex += 1;
        }
        const metadata = {
            rng: updatedRng,
            playerDecks,
            initialDeckCounts: Object.fromEntries(Object.entries(playerDecks).map(([pid, cards])=>[
                    Number(pid),
                    Array.isArray(cards) ? cards.length : 0
                ])),
            roundState: null,
            lastRound: null,
            winnerId: null
        };
        const roundState = (0, _roundstatehelper.buildInitialRoundState)(metadata, players);
        // For bot scheduling: if a bot has an available action (i.e. still has cards),
        // make it the "current player" so the engine can trigger the bot turn.
        const waitingSet = new Set(roundState.waitingPlayers ?? []);
        const bot = players.find((p)=>p?.isBot && waitingSet.has(p.id));
        const currentPlayerId = bot && typeof bot.id === 'number' ? bot.id : baseState.turn?.currentPlayerId ?? players[0]?.id ?? null;
        const starterName = typeof currentPlayerId === 'number' ? players.find((p)=>p?.id === currentPlayerId)?.username?.trim() ?? `Joueur ${currentPlayerId}` : null;
        const baseLog = Array.isArray(baseState.log) ? baseState.log : [];
        const log = starterName != null && starterName.length > 0 ? [
            ...baseLog,
            {
                message: `C'est au tour de ${starterName}.`
            }
        ] : baseLog;
        return {
            ...baseState,
            log,
            turn: {
                ...baseState.turn ?? {
                    direction: 1
                },
                currentPlayerId: typeof currentPlayerId === 'number' ? currentPlayerId : null,
                direction: 1
            },
            metadata: {
                ...metadata,
                roundState
            }
        };
    }
    constructor(random){
        this.random = random;
    }
};
ZigEtZagSetupService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _randomservice.RandomService === "undefined" ? Object : _randomservice.RandomService
    ])
], ZigEtZagSetupService);
