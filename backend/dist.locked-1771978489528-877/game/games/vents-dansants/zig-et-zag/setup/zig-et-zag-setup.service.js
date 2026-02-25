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
exports.ZigEtZagSetupService = void 0;
const common_1 = require("@nestjs/common");
const setup_service_helper_1 = require("../../../../setup/setup-service.helper");
const random_service_1 = require("../../../../modules/random/services/random.service");
const zig_et_zag_cards_1 = require("../model/zig-et-zag-cards");
const round_state_helper_1 = require("../round-state.helper");
let ZigEtZagSetupService = class ZigEtZagSetupService {
    random;
    constructor(random) {
        this.random = random;
    }
    hydrateInitialState(baseState) {
        const players = (0, setup_service_helper_1.getSafePlayers)(baseState);
        const metaSeed = (baseState.metadata ?? {});
        const rng = (0, setup_service_helper_1.getRngMeta)(metaSeed);
        const deck = zig_et_zag_cards_1.ZIG_ET_ZAG_DECK.map((card) => card.id);
        const { values: shuffledDeck, meta: updatedRng } = this.random.shuffle(rng, deck);
        const activePlayers = players.filter((player) => typeof player?.id === 'number');
        const playerIds = activePlayers.map((player) => player.id);
        const playerDecks = {};
        for (const pid of playerIds) {
            playerDecks[pid] = [];
        }
        let dealIndex = 0;
        for (const cardId of shuffledDeck) {
            if (!playerIds.length)
                break;
            const pid = playerIds[dealIndex % playerIds.length];
            playerDecks[pid] = [...(playerDecks[pid] ?? []), cardId];
            dealIndex += 1;
        }
        const metadata = {
            rng: updatedRng,
            playerDecks,
            initialDeckCounts: Object.fromEntries(Object.entries(playerDecks).map(([pid, cards]) => [
                Number(pid),
                Array.isArray(cards) ? cards.length : 0,
            ])),
            roundState: null,
            lastRound: null,
            winnerId: null,
        };
        const roundState = (0, round_state_helper_1.buildInitialRoundState)(metadata, players);
        const waitingSet = new Set(roundState.waitingPlayers ?? []);
        const bot = players.find((p) => p?.isBot && waitingSet.has(p.id));
        const currentPlayerId = bot && typeof bot.id === 'number'
            ? bot.id
            : (baseState.turn?.currentPlayerId ?? players[0]?.id ?? null);
        const starterName = typeof currentPlayerId === 'number'
            ? (players.find((p) => p?.id === currentPlayerId)?.username?.trim() ??
                `Joueur ${currentPlayerId}`)
            : null;
        const baseLog = Array.isArray(baseState.log) ? baseState.log : [];
        const log = starterName != null && starterName.length > 0
            ? [...baseLog, { message: `C'est au tour de ${starterName}.` }]
            : baseLog;
        return {
            ...baseState,
            log,
            turn: {
                ...(baseState.turn ?? { direction: 1 }),
                currentPlayerId: typeof currentPlayerId === 'number' ? currentPlayerId : null,
                direction: 1,
            },
            metadata: {
                ...metadata,
                roundState,
            },
        };
    }
};
exports.ZigEtZagSetupService = ZigEtZagSetupService;
exports.ZigEtZagSetupService = ZigEtZagSetupService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [random_service_1.RandomService])
], ZigEtZagSetupService);
//# sourceMappingURL=zig-et-zag-setup.service.js.map