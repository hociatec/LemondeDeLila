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
exports.LesMainsSetupService = void 0;
const common_1 = require("@nestjs/common");
const setup_service_helper_1 = require("../../../../setup/setup-service.helper");
const random_service_1 = require("../../../../modules/random/services/random.service");
const les_mains_de_la_terre_cards_1 = require("../model/les-mains-de-la-terre-cards");
let LesMainsSetupService = class LesMainsSetupService {
    random;
    constructor(random) {
        this.random = random;
    }
    hydrateInitialState(baseState) {
        const players = (0, setup_service_helper_1.getSafePlayers)(baseState);
        const playerIds = players
            .filter((player) => typeof player?.id === 'number')
            .map((player) => player.id);
        const seedMeta = (baseState.metadata ?? {});
        const rngSeed = (0, setup_service_helper_1.getRngMeta)(seedMeta);
        const deck = les_mains_de_la_terre_cards_1.LES_MAINS_DECK.map((card) => card.id);
        const { values: shuffledDeck, meta: updatedRng } = this.random.shuffle(rngSeed, deck);
        const hands = {};
        playerIds.forEach((pid) => {
            hands[pid] = [];
        });
        const queue = [...playerIds];
        const remainingDeck = [...shuffledDeck];
        const specialBuffer = [];
        while (queue.length && remainingDeck.length) {
            const playerId = queue.shift();
            const cardId = remainingDeck.shift();
            if (!cardId)
                break;
            if ((0, les_mains_de_la_terre_cards_1.isLesMainsSpecialCard)(cardId)) {
                specialBuffer.push(cardId);
                queue.unshift(playerId);
                continue;
            }
            hands[playerId] = [...hands[playerId], cardId];
            if (hands[playerId].length < 6) {
                queue.push(playerId);
            }
        }
        const metadata = {
            rng: updatedRng,
            deck: [...specialBuffer, ...remainingDeck],
            discard: [],
            hands,
            completedFamilies: playerIds.reduce((acc, pid) => {
                acc[pid] = [];
                return acc;
            }, {}),
            statuses: { skipTurn: {} },
            extraDraws: {},
            freeFamilyRequest: {},
            bonusMetierDisparuUsed: {},
            winnerId: null,
        };
        return {
            ...baseState,
            metadata,
        };
    }
};
exports.LesMainsSetupService = LesMainsSetupService;
exports.LesMainsSetupService = LesMainsSetupService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [random_service_1.RandomService])
], LesMainsSetupService);
//# sourceMappingURL=les-mains-de-la-terre-setup.service.js.map