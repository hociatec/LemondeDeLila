"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "PimpMyRideSetupService", {
    enumerable: true,
    get: function() {
        return PimpMyRideSetupService;
    }
});
const _common = require("@nestjs/common");
const _setupservicehelper = require("../../../../setup/setup-service.helper");
const _randomservice = require("../../../../modules/random/services/random.service");
const _pimpmyridecards = require("../model/pimp-my-ride-cards");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let PimpMyRideSetupService = class PimpMyRideSetupService {
    hydrateInitialState(baseState) {
        const players = (0, _setupservicehelper.getSafePlayers)(baseState);
        const rngSeed = baseState.metadata ?? {};
        const { values: shuffledDeck, meta: updatedRng } = this.random.shuffle(rngSeed.rng ?? {}, _pimpmyridecards.PIMP_MY_RIDE_DECK.map((card)=>card.id));
        const remaining = [
            ...shuffledDeck
        ];
        const hands = {};
        const progress = {};
        for (const player of players){
            if (!player?.id) continue;
            const hand = [];
            for(let i = 0; i < 3 && remaining.length; i += 1){
                hand.push(remaining.shift());
            }
            hands[player.id] = hand;
            progress[player.id] = {
                stageIndex: 0,
                carParts: [],
                completedCars: []
            };
        }
        const metadata = {
            rng: updatedRng,
            deck: remaining,
            discard: [],
            hands,
            progress,
            drawnPlayerId: null,
            drawnCardId: null,
            carNameIndex: 0,
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
PimpMyRideSetupService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _randomservice.RandomService === "undefined" ? Object : _randomservice.RandomService
    ])
], PimpMyRideSetupService);
