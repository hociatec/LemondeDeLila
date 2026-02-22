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
exports.BandeABananeSetupService = void 0;
const common_1 = require("@nestjs/common");
const setup_service_helper_1 = require("../../../../setup/setup-service.helper");
const random_service_1 = require("../../../../modules/random/services/random.service");
const la_bande_a_banane_cards_1 = require("../model/la-bande-a-banane-cards");
let BandeABananeSetupService = class BandeABananeSetupService {
    random;
    constructor(random) {
        this.random = random;
    }
    hydrateInitialState(baseState) {
        const players = (0, setup_service_helper_1.getSafePlayers)(baseState);
        const metaSeed = (baseState.metadata ?? {});
        const rngSeed = (0, setup_service_helper_1.getRngMeta)(metaSeed);
        const deck = la_bande_a_banane_cards_1.BANDE_A_BANANE_DECK.map((card) => card.id);
        const { values: shuffledDeck, meta: updatedRng } = this.random.shuffle(rngSeed, deck);
        const remainingDeck = [...shuffledDeck];
        const hands = {};
        const troops = {};
        const skipTurn = {};
        for (const player of players) {
            if (!player?.id)
                continue;
            const hand = [];
            for (let i = 0; i < 5; i += 1) {
                if (!remainingDeck.length)
                    break;
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
                skipTurn,
            },
            drawnPlayerId: null,
            winnerId: null,
        };
        return {
            ...baseState,
            metadata,
        };
    }
};
exports.BandeABananeSetupService = BandeABananeSetupService;
exports.BandeABananeSetupService = BandeABananeSetupService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [random_service_1.RandomService])
], BandeABananeSetupService);
//# sourceMappingURL=la-bande-a-banane-setup.service.js.map