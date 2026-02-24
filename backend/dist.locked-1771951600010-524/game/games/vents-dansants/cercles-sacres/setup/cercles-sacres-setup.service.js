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
exports.CerclesSacresSetupService = void 0;
const common_1 = require("@nestjs/common");
const setup_service_helper_1 = require("../../../../setup/setup-service.helper");
const random_service_1 = require("../../../../modules/random/services/random.service");
const cercles_sacres_cards_1 = require("../model/cercles-sacres-cards");
let CerclesSacresSetupService = class CerclesSacresSetupService {
    random;
    constructor(random) {
        this.random = random;
    }
    hydrateInitialState(baseState) {
        const players = (0, setup_service_helper_1.getSafePlayers)(baseState);
        const metaSeed = (baseState.metadata ?? {});
        const rng = (0, setup_service_helper_1.getRngMeta)(metaSeed);
        const deck = cercles_sacres_cards_1.CERCLES_SACRES_DECK.map((card) => card.id);
        const { values: shuffledDeck, meta: updatedRng } = this.random.shuffle(rng, deck);
        const remainingDeck = [...shuffledDeck];
        const hands = {};
        const circles = {};
        for (const player of players) {
            const playerId = player?.id;
            if (playerId == null)
                continue;
            const hand = [];
            for (let i = 0; i < 6; i += 1) {
                if (!remainingDeck.length)
                    break;
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
            winnerId: null,
        };
        return {
            ...baseState,
            metadata,
        };
    }
};
exports.CerclesSacresSetupService = CerclesSacresSetupService;
exports.CerclesSacresSetupService = CerclesSacresSetupService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [random_service_1.RandomService])
], CerclesSacresSetupService);
//# sourceMappingURL=cercles-sacres-setup.service.js.map