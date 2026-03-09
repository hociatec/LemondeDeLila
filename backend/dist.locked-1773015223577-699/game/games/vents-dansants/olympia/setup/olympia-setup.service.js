"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "OlympiaSetupService", {
    enumerable: true,
    get: function() {
        return OlympiaSetupService;
    }
});
const _common = require("@nestjs/common");
const _setupservicehelper = require("../../../../setup/setup-service.helper");
const _randomservice = require("../../../../modules/random/services/random.service");
const _olympiacards = require("../model/olympia-cards");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
const DECK_ORDER = [
    'divinite',
    'heros',
    'creatures',
    'exploits',
    'actions',
    'attaques',
    'evenements'
];
let OlympiaSetupService = class OlympiaSetupService {
    hydrateInitialState(baseState) {
        const players = (0, _setupservicehelper.getSafePlayers)(baseState);
        const seedMeta = baseState.metadata ?? {};
        let rngMeta = (0, _setupservicehelper.getRngMeta)(seedMeta);
        const decks = {};
        for (const deckType of DECK_ORDER){
            const available = [
                ..._olympiacards.OLYMPIA_DECKS[deckType] ?? []
            ];
            const { values, meta } = this.random.shuffle(rngMeta, available);
            decks[deckType] = values;
            rngMeta = meta;
        }
        const hands = {};
        const divinity = {};
        const prestige = {};
        for (const player of players){
            if (player?.id == null) continue;
            const playerId = player.id;
            prestige[playerId] = 0;
            hands[playerId] = [];
            const divinityCard = this.drawFromDeck(decks, 'divinite');
            divinity[playerId] = divinityCard.cardId ?? '';
            this.drawInitialCards(hands[playerId], decks, 'creatures', 2);
            const actionCard = this.drawFromDeck(decks, 'actions');
            if (actionCard.cardId) {
                hands[playerId].push(actionCard.cardId);
            } else {
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
            winnerId: null
        };
        return {
            ...baseState,
            status: 'started',
            phase: 'round',
            metadata
        };
    }
    drawInitialCards(hand, decks, deckType, amount) {
        for(let i = 0; i < amount; i += 1){
            const entry = this.drawFromDeck(decks, deckType);
            if (!entry?.cardId) break;
            hand.push(entry.cardId);
        }
    }
    drawFromDeck(decks, deckType) {
        const pile = decks[deckType] ?? [];
        if (!pile.length) {
            return {
                cardId: null
            };
        }
        const [cardId, ...rest] = pile;
        decks[deckType] = rest;
        return {
            cardId
        };
    }
    constructor(random){
        this.random = random;
    }
};
OlympiaSetupService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _randomservice.RandomService === "undefined" ? Object : _randomservice.RandomService
    ])
], OlympiaSetupService);
