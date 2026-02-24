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
exports.DameNatureSetupService = void 0;
const common_1 = require("@nestjs/common");
const setup_service_helper_1 = require("../../../../setup/setup-service.helper");
const random_service_1 = require("../../../../modules/random/services/random.service");
const dame_nature_cards_1 = require("../model/dame-nature-cards");
let DameNatureSetupService = class DameNatureSetupService {
    random;
    constructor(random) {
        this.random = random;
    }
    hydrateInitialState(baseState) {
        const players = (0, setup_service_helper_1.getSafePlayers)(baseState);
        const rngSeed = (baseState.metadata ?? {});
        let rngMeta = (0, setup_service_helper_1.getRngMeta)(rngSeed);
        const { values: shuffledFamilies, meta: updatedMeta } = this.random.shuffle(rngMeta, dame_nature_cards_1.DAME_NATURE_FAMILY_CARD_IDS);
        rngMeta = updatedMeta;
        const hands = {};
        const families = {};
        const remaining = [...shuffledFamilies];
        for (const player of players) {
            if (!player?.id)
                continue;
            const hand = [];
            const familyMap = {};
            for (let i = 0; i < 5 && remaining.length; i += 1) {
                const cardId = remaining.shift();
                hand.push(cardId);
                const familyId = dame_nature_cards_1.DAME_NATURE_CARD_BY_ID[cardId]?.familyId ?? 'unknown';
                familyMap[familyId] = [...(familyMap[familyId] ?? []), cardId];
            }
            hands[player.id] = hand;
            families[player.id] = familyMap;
        }
        const drawPile = [
            ...remaining,
            ...dame_nature_cards_1.DAME_NATURE_QUIZ_CARD_IDS,
            ...dame_nature_cards_1.DAME_NATURE_NATURE_CARD_IDS,
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
            winnerId: null,
        };
        return { ...baseState, metadata };
    }
};
exports.DameNatureSetupService = DameNatureSetupService;
exports.DameNatureSetupService = DameNatureSetupService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [random_service_1.RandomService])
], DameNatureSetupService);
//# sourceMappingURL=dame-nature-setup.service.js.map