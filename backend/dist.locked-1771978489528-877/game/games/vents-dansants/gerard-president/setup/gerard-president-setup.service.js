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
exports.GerardPresidentSetupService = void 0;
const common_1 = require("@nestjs/common");
const setup_service_helper_1 = require("../../../../setup/setup-service.helper");
const random_service_1 = require("../../../../modules/random/services/random.service");
const gerard_president_cards_1 = require("../model/gerard-president-cards");
const gerard_president_state_entity_1 = require("../model/gerard-president-state.entity");
let GerardPresidentSetupService = class GerardPresidentSetupService {
    random;
    constructor(random) {
        this.random = random;
    }
    hydrateInitialState(baseState) {
        const players = (0, setup_service_helper_1.getSafePlayers)(baseState);
        const metaSeed = (baseState.metadata ?? {});
        const rng = (0, setup_service_helper_1.getRngMeta)(metaSeed);
        const nameDeck = [...gerard_president_cards_1.GERARD_PRESIDENT_NAMES];
        const themeDeck = [...gerard_president_cards_1.GERARD_PRESIDENT_THEMES];
        const specialDeck = gerard_president_cards_1.GERARD_PRESIDENT_SPECIAL_CARDS.flatMap((card) => Array.from({ length: 2 }, () => card.id));
        const { values: shuffledNames, meta: afterNameShuffle } = this.random.shuffle(rng, nameDeck);
        const { values: shuffledThemes, meta: afterThemeShuffle } = this.random.shuffle(afterNameShuffle, themeDeck);
        const { values: shuffledSpecials, meta: afterSpecialShuffle } = this.random.shuffle(afterThemeShuffle, specialDeck);
        const hands = {};
        const specialHands = {};
        const scores = {};
        const nameQueue = [...shuffledNames];
        const specialQueue = [...shuffledSpecials];
        for (const player of players) {
            if (!player?.id) {
                continue;
            }
            hands[player.id] = [];
            for (let i = 0; i < 10; i += 1) {
                const card = nameQueue.shift();
                if (!card)
                    break;
                hands[player.id].push(card);
            }
            specialHands[player.id] = [];
            for (let i = 0; i < 2; i += 1) {
                const card = specialQueue.shift();
                if (!card)
                    break;
                specialHands[player.id].push(card);
            }
            scores[player.id] = 0;
        }
        const masterId = players.length > 0 ? (players[0].id ?? null) : null;
        const metadata = {
            rng: afterSpecialShuffle,
            nameDeck: nameQueue,
            themeDeck: shuffledThemes,
            specialDeck: specialQueue,
            nameDiscard: [],
            themeDiscard: [],
            specialDiscard: [],
            hands,
            specialHands,
            scores,
            masterId,
            currentTheme: null,
            secondTheme: null,
            lockedName: null,
            peaceTurnsRemaining: 0,
            winnerId: null,
            roundNumber: 0,
            targetScore: gerard_president_state_entity_1.GERARD_PRESIDENT_TARGET_SCORE,
            submissions: {},
            pendingPlayers: [],
            roundPhase: 'waiting_theme',
            specialsPlayed: {},
            extraNamesAllowed: {},
            defenseActive: {},
            specialAttackers: {},
            themeSecretActive: false,
            juryOverrideId: null,
            dominoRemaining: 0,
            ghostNames: [],
        };
        return {
            ...baseState,
            metadata,
            turnIndex: 0,
            turn: {
                currentPlayerId: masterId ?? null,
                direction: 1,
            },
        };
    }
};
exports.GerardPresidentSetupService = GerardPresidentSetupService;
exports.GerardPresidentSetupService = GerardPresidentSetupService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [random_service_1.RandomService])
], GerardPresidentSetupService);
//# sourceMappingURL=gerard-president-setup.service.js.map