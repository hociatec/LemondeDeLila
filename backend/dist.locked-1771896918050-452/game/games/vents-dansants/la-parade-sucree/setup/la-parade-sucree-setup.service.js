"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LaParadeSucreeSetupService = void 0;
const common_1 = require("@nestjs/common");
const setup_service_helper_1 = require("../../../../setup/setup-service.helper");
const random_service_1 = require("../../../../modules/random/services/random.service");
const la_parade_sucree_cards_1 = require("../model/la-parade-sucree-cards");
let LaParadeSucreeSetupService = class LaParadeSucreeSetupService {
    random;
    constructor(random) {
        this.random = random;
    }
    hydrateInitialState(baseState) {
        const players = (0, setup_service_helper_1.getSafePlayers)(baseState);
        const seedMeta = (baseState.metadata ?? {});
        let rngMeta = (0, setup_service_helper_1.getRngMeta)(seedMeta);
        const deck = [...la_parade_sucree_cards_1.LA_PARADE_CARD_DECK];
        const { values: shuffled, meta: updatedRng } = this.random.shuffle(rngMeta, deck);
        rngMeta = updatedRng;
        const hands = {};
        players.forEach((player) => {
            if (player?.id == null)
                return;
            hands[player.id] = [];
        });
        let cursor = 0;
        while (cursor < shuffled.length) {
            for (const player of players) {
                if (player?.id == null)
                    continue;
                if (cursor >= shuffled.length)
                    break;
                const card = shuffled[cursor];
                hands[player.id].push(card.id);
                cursor += 1;
            }
        }
        const candies = {};
        players.forEach((player) => {
            if (player?.id == null)
                return;
            const baseCandy = {
                Chamallow: la_parade_sucree_cards_1.INITIAL_CANDIES.Chamallow,
                Chocobon: la_parade_sucree_cards_1.INITIAL_CANDIES.Chocobon,
                Balisto: la_parade_sucree_cards_1.INITIAL_CANDIES.Balisto,
            };
            candies[player.id] = baseCandy;
        });
        const metadata = {
            rng: rngMeta,
            hands,
            candies,
            sequenceIndex: 0,
            played: [],
            winnerId: null,
        };
        return {
            ...baseState,
            status: 'started',
            phase: 'round',
            metadata,
        };
    }
};
exports.LaParadeSucreeSetupService = LaParadeSucreeSetupService;
exports.LaParadeSucreeSetupService = LaParadeSucreeSetupService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [random_service_1.RandomService])
], LaParadeSucreeSetupService);
//# sourceMappingURL=la-parade-sucree-setup.service.js.map