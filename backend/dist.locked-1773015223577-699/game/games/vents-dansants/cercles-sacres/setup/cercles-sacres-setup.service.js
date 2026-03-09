"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "CerclesSacresSetupService", {
    enumerable: true,
    get: function() {
        return CerclesSacresSetupService;
    }
});
const _common = require("@nestjs/common");
const _setupservicehelper = require("../../../../setup/setup-service.helper");
const _randomservice = require("../../../../modules/random/services/random.service");
const _cerclessacrescards = require("../model/cercles-sacres-cards");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let CerclesSacresSetupService = class CerclesSacresSetupService {
    hydrateInitialState(baseState) {
        const players = (0, _setupservicehelper.getSafePlayers)(baseState);
        const metaSeed = baseState.metadata ?? {};
        const rng = (0, _setupservicehelper.getRngMeta)(metaSeed);
        const deck = _cerclessacrescards.CERCLES_SACRES_DECK.map((card)=>card.id);
        const { values: shuffledDeck, meta: updatedRng } = this.random.shuffle(rng, deck);
        const remainingDeck = [
            ...shuffledDeck
        ];
        const hands = {};
        const circles = {};
        for (const player of players){
            const playerId = player?.id;
            if (playerId == null) continue;
            const hand = [];
            for(let i = 0; i < 6; i += 1){
                if (!remainingDeck.length) break;
                hand.push(remainingDeck.shift());
            }
            hands[playerId] = hand;
            circles[playerId] = [];
        }
        const metadata = {
            rng: updatedRng,
            deck: remainingDeck,
            discard: [],
            hands,
            circles,
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
CerclesSacresSetupService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _randomservice.RandomService === "undefined" ? Object : _randomservice.RandomService
    ])
], CerclesSacresSetupService);
