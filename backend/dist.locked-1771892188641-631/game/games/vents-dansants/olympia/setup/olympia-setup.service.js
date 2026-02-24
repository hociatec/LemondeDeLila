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
exports.OlympiaSetupService = void 0;
const common_1 = require("@nestjs/common");
const setup_service_helper_1 = require("../../../../setup/setup-service.helper");
const random_service_1 = require("../../../../modules/random/services/random.service");
const olympia_cards_1 = require("../model/olympia-cards");
const DECK_ORDER = [
    'divinite',
    'heros',
    'creatures',
    'exploits',
    'actions',
    'attaques',
    'evenements',
];
let OlympiaSetupService = class OlympiaSetupService {
    random;
    constructor(random) {
        this.random = random;
    }
    hydrateInitialState(baseState) {
        const players = (0, setup_service_helper_1.getSafePlayers)(baseState);
        const seedMeta = (baseState.metadata ?? {});
        let rngMeta = (0, setup_service_helper_1.getRngMeta)(seedMeta);
        const decks = {};
        for (const deckType of DECK_ORDER) {
            const available = [...(olympia_cards_1.OLYMPIA_DECKS[deckType] ?? [])];
            const { values, meta } = this.random.shuffle(rngMeta, available);
            decks[deckType] = values;
            rngMeta = meta;
        }
        const hands = {};
        const divinity = {};
        const prestige = {};
        for (const player of players) {
            if (player?.id == null)
                continue;
            const playerId = player.id;
            prestige[playerId] = 0;
            hands[playerId] = [];
            const divinityCard = this.drawFromDeck(decks, 'divinite');
            divinity[playerId] = divinityCard.cardId ?? '';
            this.drawInitialCards(hands[playerId], decks, 'creatures', 2);
            const actionCard = this.drawFromDeck(decks, 'actions');
            if (actionCard.cardId) {
                hands[playerId].push(actionCard.cardId);
            }
            else {
                const attackCard = this.drawFromDeck(decks, 'attaques');
                if (attackCard.cardId) {
                    hands[playerId].push(attackCard.cardId);
                }
            }
        }
        const metadata = {
            rng: rngMeta,
            decks,
            discard: [],
            hands,
            divinity,
            prestige,
            statuses: {},
            skipTurn: {},
            winnerId: null,
        };
        return {
            ...baseState,
            status: 'started',
            phase: 'round',
            metadata,
        };
    }
    drawInitialCards(hand, decks, deckType, amount) {
        for (let i = 0; i < amount; i += 1) {
            const entry = this.drawFromDeck(decks, deckType);
            if (!entry?.cardId)
                break;
            hand.push(entry.cardId);
        }
    }
    drawFromDeck(decks, deckType) {
        const pile = decks[deckType] ?? [];
        if (!pile.length) {
            return { cardId: null };
        }
        const [cardId, ...rest] = pile;
        decks[deckType] = rest;
        return { cardId };
    }
};
exports.OlympiaSetupService = OlympiaSetupService;
exports.OlympiaSetupService = OlympiaSetupService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [random_service_1.RandomService])
], OlympiaSetupService);
//# sourceMappingURL=olympia-setup.service.js.map