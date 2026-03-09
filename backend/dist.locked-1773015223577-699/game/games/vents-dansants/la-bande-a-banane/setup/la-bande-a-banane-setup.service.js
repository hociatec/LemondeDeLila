"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "BandeABananeSetupService", {
    enumerable: true,
    get: function() {
        return BandeABananeSetupService;
    }
});
const _common = require("@nestjs/common");
const _setupservicehelper = require("../../../../setup/setup-service.helper");
const _randomservice = require("../../../../modules/random/services/random.service");
const _labandeabananecards = require("../model/la-bande-a-banane-cards");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let BandeABananeSetupService = class BandeABananeSetupService {
    hydrateInitialState(baseState) {
        const players = (0, _setupservicehelper.getSafePlayers)(baseState);
        const metaSeed = baseState.metadata ?? {};
        const rngSeed = (0, _setupservicehelper.getRngMeta)(metaSeed);
        const deck = _labandeabananecards.BANDE_A_BANANE_DECK.map((card)=>card.id);
        const { values: shuffledDeck, meta: updatedRng } = this.random.shuffle(rngSeed, deck);
        const remainingDeck = [
            ...shuffledDeck
        ];
        const hands = {};
        const troops = {};
        const skipTurn = {};
        for (const player of players){
            if (!player?.id) continue;
            const hand = [];
            for(let i = 0; i < 5; i += 1){
                if (!remainingDeck.length) break;
                hand.push(remainingDeck.shift());
            }
            hands[player.id] = hand;
            troops[player.id] = [];
            skipTurn[player.id] = 0;
        }
        const metadata = {
            rng: updatedRng,
            deck: remainingDeck,
            discard: [],
            hands,
            troops,
            statuses: {
                skipTurn
            },
            drawnPlayerId: null,
            winnerId: null
        };
        return {
            ...baseState,
            metadata
        };
    }
    constructor(random){
        this.random = random;
    }
};
BandeABananeSetupService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _randomservice.RandomService === "undefined" ? Object : _randomservice.RandomService
    ])
], BandeABananeSetupService);
