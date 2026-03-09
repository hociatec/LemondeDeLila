"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "EntreRitesSetupService", {
    enumerable: true,
    get: function() {
        return EntreRitesSetupService;
    }
});
const _common = require("@nestjs/common");
const _setupservicehelper = require("../../../../setup/setup-service.helper");
const _randomservice = require("../../../../modules/random/services/random.service");
const _entreritescards = require("../model/entre-rites-cards");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let EntreRitesSetupService = class EntreRitesSetupService {
    hydrateInitialState(baseState) {
        const players = (0, _setupservicehelper.getSafePlayers)(baseState);
        const playerIds = players.filter((player)=>player?.id != null).map((player)=>player.id);
        const deckIds = _entreritescards.ENTRE_RITES_DECK.map((card)=>card.id);
        const rngSeed = (baseState.metadata ?? {}).rng ?? {};
        const { values: shuffledDeck, meta: rng } = this.random.shuffle(rngSeed, deckIds);
        const hands = {};
        const familyCollections = {};
        const completedFamilies = {};
        const specialsPlayed = {};
        const specialsPlayedCount = {};
        let deckIndex = 0;
        for (const playerId of playerIds){
            const hand = [];
            for(let i = 0; i < 5; i += 1){
                if (deckIndex >= shuffledDeck.length) break;
                hand.push(shuffledDeck[deckIndex++]);
            }
            hands[playerId] = hand;
            familyCollections[playerId] = this.buildCollections(hand);
            completedFamilies[playerId] = [];
            specialsPlayed[playerId] = [];
            specialsPlayedCount[playerId] = 0;
        }
        const metadata = {
            rng,
            deck: shuffledDeck.slice(deckIndex),
            discard: [],
            hands,
            familyCollections,
            completedFamilies,
            specialsPlayed,
            specialsPlayedCount,
            peaceTurnsRemaining: 0,
            silenceUntilPlayerId: null
        };
        return {
            ...baseState,
            metadata
        };
    }
    buildCollections(hand) {
        const collections = {};
        for (const cardId of hand){
            const card = _entreritescards.ENTRE_RITES_CARD_BY_ID[cardId];
            if (card?.type === 'family') {
                const bucket = [
                    ...collections[card.familyId] ?? []
                ];
                bucket.push(cardId);
                collections[card.familyId] = bucket;
            }
        }
        return collections;
    }
    constructor(random){
        this.random = random;
    }
};
EntreRitesSetupService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _randomservice.RandomService === "undefined" ? Object : _randomservice.RandomService
    ])
], EntreRitesSetupService);
