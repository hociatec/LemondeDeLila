"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "LesMainsSetupService", {
    enumerable: true,
    get: function() {
        return LesMainsSetupService;
    }
});
const _common = require("@nestjs/common");
const _setupservicehelper = require("../../../../setup/setup-service.helper");
const _randomservice = require("../../../../modules/random/services/random.service");
const _lesmainsdelaterrecards = require("../model/les-mains-de-la-terre-cards");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let LesMainsSetupService = class LesMainsSetupService {
    hydrateInitialState(baseState) {
        const players = (0, _setupservicehelper.getSafePlayers)(baseState);
        const playerIds = players.filter((player)=>typeof player?.id === 'number').map((player)=>player.id);
        const seedMeta = baseState.metadata ?? {};
        const rngSeed = (0, _setupservicehelper.getRngMeta)(seedMeta);
        const deck = _lesmainsdelaterrecards.LES_MAINS_DECK.map((card)=>card.id);
        const { values: shuffledDeck, meta: updatedRng } = this.random.shuffle(rngSeed, deck);
        const hands = {};
        playerIds.forEach((pid)=>{
            hands[pid] = [];
        });
        const queue = [
            ...playerIds
        ];
        const remainingDeck = [
            ...shuffledDeck
        ];
        const specialBuffer = [];
        while(queue.length && remainingDeck.length){
            const playerId = queue.shift();
            const cardId = remainingDeck.shift();
            if (!cardId) break;
            if ((0, _lesmainsdelaterrecards.isLesMainsSpecialCard)(cardId)) {
                specialBuffer.push(cardId);
                queue.unshift(playerId);
                continue;
            }
            hands[playerId] = [
                ...hands[playerId],
                cardId
            ];
            if (hands[playerId].length < 6) {
                queue.push(playerId);
            }
        }
        const metadata = {
            rng: updatedRng,
            deck: [
                ...specialBuffer,
                ...remainingDeck
            ],
            discard: [],
            hands,
            completedFamilies: playerIds.reduce((acc, pid)=>{
                acc[pid] = [];
                return acc;
            }, {}),
            statuses: {
                skipTurn: {}
            },
            extraDraws: {},
            freeFamilyRequest: {},
            bonusMetierDisparuUsed: {},
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
LesMainsSetupService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _randomservice.RandomService === "undefined" ? Object : _randomservice.RandomService
    ])
], LesMainsSetupService);
