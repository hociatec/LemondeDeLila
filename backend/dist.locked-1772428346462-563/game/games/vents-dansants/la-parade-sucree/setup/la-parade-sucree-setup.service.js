"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "LaParadeSucreeSetupService", {
    enumerable: true,
    get: function() {
        return LaParadeSucreeSetupService;
    }
});
const _common = require("@nestjs/common");
const _setupservicehelper = require("../../../../setup/setup-service.helper");
const _randomservice = require("../../../../modules/random/services/random.service");
const _laparadesucreecards = require("../model/la-parade-sucree-cards");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let LaParadeSucreeSetupService = class LaParadeSucreeSetupService {
    hydrateInitialState(baseState) {
        const players = (0, _setupservicehelper.getSafePlayers)(baseState);
        const seedMeta = baseState.metadata ?? {};
        let rngMeta = (0, _setupservicehelper.getRngMeta)(seedMeta);
        const deck = [
            ..._laparadesucreecards.LA_PARADE_CARD_DECK
        ];
        const { values: shuffled, meta: updatedRng } = this.random.shuffle(rngMeta, deck);
        rngMeta = updatedRng;
        const hands = {};
        players.forEach((player)=>{
            if (player?.id == null) return;
            hands[player.id] = [];
        });
        let cursor = 0;
        while(cursor < shuffled.length){
            for (const player of players){
                if (player?.id == null) continue;
                if (cursor >= shuffled.length) break;
                const card = shuffled[cursor];
                hands[player.id].push(card.id);
                cursor += 1;
            }
        }
        const candies = {};
        players.forEach((player)=>{
            if (player?.id == null) return;
            const baseCandy = {
                Chamallow: _laparadesucreecards.INITIAL_CANDIES.Chamallow,
                Chocobon: _laparadesucreecards.INITIAL_CANDIES.Chocobon,
                Balisto: _laparadesucreecards.INITIAL_CANDIES.Balisto
            };
            candies[player.id] = baseCandy;
        });
        const metadata = {
            rng: rngMeta,
            hands,
            candies,
            sequenceIndex: 0,
            played: [],
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
LaParadeSucreeSetupService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _randomservice.RandomService === "undefined" ? Object : _randomservice.RandomService
    ])
], LaParadeSucreeSetupService);
