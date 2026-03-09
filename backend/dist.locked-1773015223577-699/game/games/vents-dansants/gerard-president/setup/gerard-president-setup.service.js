"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "GerardPresidentSetupService", {
    enumerable: true,
    get: function() {
        return GerardPresidentSetupService;
    }
});
const _common = require("@nestjs/common");
const _setupservicehelper = require("../../../../setup/setup-service.helper");
const _randomservice = require("../../../../modules/random/services/random.service");
const _gerardpresidentcards = require("../model/gerard-president-cards");
const _gerardpresidentstateentity = require("../model/gerard-president-state.entity");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let GerardPresidentSetupService = class GerardPresidentSetupService {
    hydrateInitialState(baseState) {
        const players = (0, _setupservicehelper.getSafePlayers)(baseState);
        const metaSeed = baseState.metadata ?? {};
        const rng = (0, _setupservicehelper.getRngMeta)(metaSeed);
        const nameDeck = [
            ..._gerardpresidentcards.GERARD_PRESIDENT_NAMES
        ];
        const themeDeck = [
            ..._gerardpresidentcards.GERARD_PRESIDENT_THEMES
        ];
        const specialDeck = _gerardpresidentcards.GERARD_PRESIDENT_SPECIAL_CARDS.flatMap((card)=>Array.from({
                length: 2
            }, ()=>card.id));
        const { values: shuffledNames, meta: afterNameShuffle } = this.random.shuffle(rng, nameDeck);
        const { values: shuffledThemes, meta: afterThemeShuffle } = this.random.shuffle(afterNameShuffle, themeDeck);
        const { values: shuffledSpecials, meta: afterSpecialShuffle } = this.random.shuffle(afterThemeShuffle, specialDeck);
        const hands = {};
        const specialHands = {};
        const scores = {};
        const nameQueue = [
            ...shuffledNames
        ];
        const specialQueue = [
            ...shuffledSpecials
        ];
        for (const player of players){
            if (!player?.id) {
                continue;
            }
            hands[player.id] = [];
            for(let i = 0; i < 10; i += 1){
                const card = nameQueue.shift();
                if (!card) break;
                hands[player.id].push(card);
            }
            specialHands[player.id] = [];
            for(let i = 0; i < 2; i += 1){
                const card = specialQueue.shift();
                if (!card) break;
                specialHands[player.id].push(card);
            }
            scores[player.id] = 0;
        }
        const masterId = players.length > 0 ? players[0].id ?? null : null;
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
            targetScore: _gerardpresidentstateentity.GERARD_PRESIDENT_TARGET_SCORE,
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
            ghostNames: []
        };
        return {
            ...baseState,
            metadata,
            turnIndex: 0,
            turn: {
                currentPlayerId: masterId ?? null,
                direction: 1
            }
        };
    }
    constructor(random){
        this.random = random;
    }
};
GerardPresidentSetupService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _randomservice.RandomService === "undefined" ? Object : _randomservice.RandomService
    ])
], GerardPresidentSetupService);
