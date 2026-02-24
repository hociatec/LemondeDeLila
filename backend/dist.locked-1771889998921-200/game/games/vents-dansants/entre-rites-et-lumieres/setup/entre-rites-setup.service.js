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
exports.EntreRitesSetupService = void 0;
const common_1 = require("@nestjs/common");
const setup_service_helper_1 = require("../../../../setup/setup-service.helper");
const random_service_1 = require("../../../../modules/random/services/random.service");
const entre_rites_cards_1 = require("../model/entre-rites-cards");
let EntreRitesSetupService = class EntreRitesSetupService {
    random;
    constructor(random) {
        this.random = random;
    }
    hydrateInitialState(baseState) {
        const players = (0, setup_service_helper_1.getSafePlayers)(baseState);
        const playerIds = players
            .filter((player) => player?.id != null)
            .map((player) => player.id);
        const deckIds = entre_rites_cards_1.ENTRE_RITES_DECK.map((card) => card.id);
        const rngSeed = (baseState.metadata ?? {}).rng ?? {};
        const { values: shuffledDeck, meta: rng } = this.random.shuffle(rngSeed, deckIds);
        const hands = {};
        const familyCollections = {};
        const completedFamilies = {};
        const specialsPlayed = {};
        const specialsPlayedCount = {};
        let deckIndex = 0;
        for (const playerId of playerIds) {
            const hand = [];
            for (let i = 0; i < 5; i += 1) {
                if (deckIndex >= shuffledDeck.length)
                    break;
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
            silenceUntilPlayerId: null,
        };
        return {
            ...baseState,
            metadata,
        };
    }
    buildCollections(hand) {
        const collections = {};
        for (const cardId of hand) {
            const card = entre_rites_cards_1.ENTRE_RITES_CARD_BY_ID[cardId];
            if (card?.type === 'family') {
                const bucket = [...(collections[card.familyId] ?? [])];
                bucket.push(cardId);
                collections[card.familyId] = bucket;
            }
        }
        return collections;
    }
};
exports.EntreRitesSetupService = EntreRitesSetupService;
exports.EntreRitesSetupService = EntreRitesSetupService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [random_service_1.RandomService])
], EntreRitesSetupService);
//# sourceMappingURL=entre-rites-setup.service.js.map