"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "DameNatureSetupService", {
    enumerable: true,
    get: function() {
        return DameNatureSetupService;
    }
});
const _common = require("@nestjs/common");
const _setupservicehelper = require("../../../../setup/setup-service.helper");
const _randomservice = require("../../../../modules/random/services/random.service");
const _damenaturecards = require("../model/dame-nature-cards");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let DameNatureSetupService = class DameNatureSetupService {
    hydrateInitialState(baseState) {
        const players = (0, _setupservicehelper.getSafePlayers)(baseState);
        const rngSeed = baseState.metadata ?? {};
        let rngMeta = (0, _setupservicehelper.getRngMeta)(rngSeed);
        const { values: shuffledFamilies, meta: updatedMeta } = this.random.shuffle(rngMeta, _damenaturecards.DAME_NATURE_FAMILY_CARD_IDS);
        rngMeta = updatedMeta;
        const hands = {};
        const families = {};
        const remaining = [
            ...shuffledFamilies
        ];
        for (const player of players){
            if (!player?.id) continue;
            const hand = [];
            const familyMap = {};
            for(let i = 0; i < 5 && remaining.length; i += 1){
                const cardId = remaining.shift();
                hand.push(cardId);
                const familyId = _damenaturecards.DAME_NATURE_CARD_BY_ID[cardId]?.familyId ?? 'unknown';
                familyMap[familyId] = [
                    ...familyMap[familyId] ?? [],
                    cardId
                ];
            }
            hands[player.id] = hand;
            families[player.id] = familyMap;
        }
        const drawPile = [
            ...remaining,
            ..._damenaturecards.DAME_NATURE_QUIZ_CARD_IDS,
            ..._damenaturecards.DAME_NATURE_NATURE_CARD_IDS
        ];
        const { values: shuffledDeck, meta: finalMeta } = this.random.shuffle(rngMeta, drawPile);
        const metadata = {
            rng: finalMeta,
            deck: shuffledDeck,
            discard: [],
            hands,
            families,
            pollutionTokens: 0,
            pollutionLoserId: null,
            lastQuizCardId: null,
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
DameNatureSetupService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _randomservice.RandomService === "undefined" ? Object : _randomservice.RandomService
    ])
], DameNatureSetupService);
