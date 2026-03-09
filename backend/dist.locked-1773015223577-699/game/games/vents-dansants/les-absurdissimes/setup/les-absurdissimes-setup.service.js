"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "AbsurdissimesSetupService", {
    enumerable: true,
    get: function() {
        return AbsurdissimesSetupService;
    }
});
const _common = require("@nestjs/common");
const _setupservicehelper = require("../../../../setup/setup-service.helper");
const _randomservice = require("../../../../modules/random/services/random.service");
const _absurdissimesdeckservice = require("../data/absurdissimes-deck.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
const DEFAULT_TARGET = 10;
let AbsurdissimesSetupService = class AbsurdissimesSetupService {
    hydrateInitialState(baseState) {
        const players = (0, _setupservicehelper.getSafePlayers)(baseState);
        const playerIds = players.filter((player)=>typeof player?.id === 'number').map((player)=>player.id);
        const seedMeta = baseState.metadata ?? {};
        let rngMeta = (0, _setupservicehelper.getRngMeta)(seedMeta);
        const whiteCards = this.deck.getWhiteCards();
        const blackCards = this.deck.getBlackCards();
        const shuffledWhite = this.random.shuffle(rngMeta, whiteCards);
        rngMeta = shuffledWhite.meta;
        const shuffledBlack = this.random.shuffle(rngMeta, blackCards);
        rngMeta = shuffledBlack.meta;
        const whiteDeck = [
            ...shuffledWhite.values
        ];
        const blackDeck = [
            ...shuffledBlack.values
        ];
        const blackHands = {};
        playerIds.forEach((pid)=>{
            blackHands[pid] = [];
            for(let i = 0; i < 10 && blackDeck.length; i += 1){
                blackHands[pid].push(blackDeck.shift());
            }
        });
        const judgeIndex = 0;
        const judgeId = playerIds[judgeIndex] ?? null;
        const remainingPlayers = playerIds.filter((pid)=>pid !== judgeId);
        const nextPlayerId = remainingPlayers[0] ?? judgeId;
        const metadata = {
            rng: rngMeta,
            whiteDeck,
            blackDeck,
            discardWhite: [],
            discardBlack: [],
            blackHands,
            currentWhite: whiteDeck.shift() ?? null,
            judgeIndex,
            roundStage: 'play',
            submissions: {},
            scores: playerIds.reduce((acc, pid)=>({
                    ...acc,
                    [pid]: 0
                }), {}),
            targetScore: Number(seedMeta.targetScore ?? DEFAULT_TARGET),
            remainingPlayers,
            winnerId: null
        };
        return {
            ...baseState,
            turn: {
                currentPlayerId: nextPlayerId,
                direction: 1
            },
            metadata
        };
    }
    constructor(deck, random){
        this.deck = deck;
        this.random = random;
    }
};
AbsurdissimesSetupService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _absurdissimesdeckservice.AbsurdissimesDeckService === "undefined" ? Object : _absurdissimesdeckservice.AbsurdissimesDeckService,
        typeof _randomservice.RandomService === "undefined" ? Object : _randomservice.RandomService
    ])
], AbsurdissimesSetupService);
