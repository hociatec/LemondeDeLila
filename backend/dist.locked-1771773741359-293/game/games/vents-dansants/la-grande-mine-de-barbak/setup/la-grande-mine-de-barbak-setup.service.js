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
exports.LaGrandeMineSetupService = void 0;
const common_1 = require("@nestjs/common");
const setup_service_helper_1 = require("../../../../setup/setup-service.helper");
const random_service_1 = require("../../../../modules/random/services/random.service");
const la_grande_mine_cards_1 = require("../model/la-grande-mine-cards");
let LaGrandeMineSetupService = class LaGrandeMineSetupService {
    random;
    constructor(random) {
        this.random = random;
    }
    hydrateInitialState(baseState) {
        const players = (0, setup_service_helper_1.getSafePlayers)(baseState);
        const seedMeta = (baseState.metadata ?? {});
        let rngMeta = (0, setup_service_helper_1.getRngMeta)(seedMeta);
        const deckIds = la_grande_mine_cards_1.LA_GRANDE_MINE_CARDS.map((card) => card.id);
        const { values: shuffled, meta: updatedRng } = this.random.shuffle(rngMeta, deckIds);
        rngMeta = updatedRng;
        const hands = {};
        players.forEach((player) => {
            if (player?.id == null)
                return;
            hands[player.id] = [];
        });
        const deckAfterDeal = [...shuffled];
        const cardsPerPlayer = 5;
        for (let i = 0; i < cardsPerPlayer; i += 1) {
            for (const player of players) {
                if (player?.id == null)
                    continue;
                if (!deckAfterDeal.length)
                    break;
                const cardId = deckAfterDeal.shift();
                if (cardId) {
                    hands[player.id].push(cardId);
                }
            }
        }
        const domains = players.reduce((acc, player) => {
            if (player?.id == null)
                return acc;
            acc[player.id] = { treasures: [], objects: [] };
            return acc;
        }, {});
        const metadata = {
            rng: rngMeta,
            deck: deckAfterDeal,
            discard: [],
            hands,
            drawnPlayerId: null,
            domains,
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
exports.LaGrandeMineSetupService = LaGrandeMineSetupService;
exports.LaGrandeMineSetupService = LaGrandeMineSetupService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [random_service_1.RandomService])
], LaGrandeMineSetupService);
//# sourceMappingURL=la-grande-mine-de-barbak-setup.service.js.map