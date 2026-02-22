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
exports.PimpMyRideSetupService = void 0;
const common_1 = require("@nestjs/common");
const setup_service_helper_1 = require("../../../../setup/setup-service.helper");
const random_service_1 = require("../../../../modules/random/services/random.service");
const pimp_my_ride_cards_1 = require("../model/pimp-my-ride-cards");
let PimpMyRideSetupService = class PimpMyRideSetupService {
    random;
    constructor(random) {
        this.random = random;
    }
    hydrateInitialState(baseState) {
        const players = (0, setup_service_helper_1.getSafePlayers)(baseState);
        const rngSeed = (baseState.metadata ?? {});
        const { values: shuffledDeck, meta: updatedRng } = this.random.shuffle(rngSeed.rng ?? {}, pimp_my_ride_cards_1.PIMP_MY_RIDE_DECK.map((card) => card.id));
        const remaining = [...shuffledDeck];
        const hands = {};
        const progress = {};
        for (const player of players) {
            if (!player?.id)
                continue;
            const hand = [];
            for (let i = 0; i < 3 && remaining.length; i += 1) {
                hand.push(remaining.shift());
            }
            hands[player.id] = hand;
            progress[player.id] = {
                stageIndex: 0,
                carParts: [],
                completedCars: [],
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
            winnerId: null,
        };
        return {
            ...baseState,
            metadata,
        };
    }
};
exports.PimpMyRideSetupService = PimpMyRideSetupService;
exports.PimpMyRideSetupService = PimpMyRideSetupService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [random_service_1.RandomService])
], PimpMyRideSetupService);
//# sourceMappingURL=pimp-my-ride-setup.service.js.map