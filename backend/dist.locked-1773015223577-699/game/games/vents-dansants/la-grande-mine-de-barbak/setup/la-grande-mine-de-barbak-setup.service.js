"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "LaGrandeMineSetupService", {
    enumerable: true,
    get: function() {
        return LaGrandeMineSetupService;
    }
});
const _common = require("@nestjs/common");
const _setupservicehelper = require("../../../../setup/setup-service.helper");
const _randomservice = require("../../../../modules/random/services/random.service");
const _lagrandeminecards = require("../model/la-grande-mine-cards");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let LaGrandeMineSetupService = class LaGrandeMineSetupService {
    hydrateInitialState(baseState) {
        const players = (0, _setupservicehelper.getSafePlayers)(baseState);
        const seedMeta = baseState.metadata ?? {};
        let rngMeta = (0, _setupservicehelper.getRngMeta)(seedMeta);
        const deckIds = _lagrandeminecards.LA_GRANDE_MINE_CARDS.map((card)=>card.id);
        const { values: shuffled, meta: updatedRng } = this.random.shuffle(rngMeta, deckIds);
        rngMeta = updatedRng;
        const hands = {};
        players.forEach((player)=>{
            if (player?.id == null) return;
            hands[player.id] = [];
        });
        const deckAfterDeal = [
            ...shuffled
        ];
        const cardsPerPlayer = 5;
        for(let i = 0; i < cardsPerPlayer; i += 1){
            for (const player of players){
                if (player?.id == null) continue;
                if (!deckAfterDeal.length) break;
                const cardId = deckAfterDeal.shift();
                if (cardId) {
                    hands[player.id].push(cardId);
                }
            }
        }
        const domains = players.reduce((acc, player)=>{
            if (player?.id == null) return acc;
            acc[player.id] = {
                treasures: [],
                objects: []
            };
            return acc;
        }, {});
        const metadata = {
            rng: rngMeta,
            deck: deckAfterDeal,
            discard: [],
            hands,
            drawnPlayerId: null,
            domains,
            winnerId: null
        };
        return {
            ...baseState,
            status: 'started',
            phase: 'round',
            metadata
        };
    }
    constructor(random){
        this.random = random;
    }
};
LaGrandeMineSetupService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _randomservice.RandomService === "undefined" ? Object : _randomservice.RandomService
    ])
], LaGrandeMineSetupService);
