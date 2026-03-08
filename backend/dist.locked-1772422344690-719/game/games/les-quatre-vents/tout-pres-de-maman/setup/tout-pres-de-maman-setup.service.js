"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "ToutPresDeMamanSetupService", {
    enumerable: true,
    get: function() {
        return ToutPresDeMamanSetupService;
    }
});
const _common = require("@nestjs/common");
const _setupservicehelper = require("../../../../setup/setup-service.helper");
const _gamecontentloaderservice = require("../../../../engine/services/game-content-loader.service");
const _randomservice = require("../../../../modules/random/services/random.service");
const _contentloaderhelper = require("../../../../setup/content-loader.helper");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let ToutPresDeMamanSetupService = class ToutPresDeMamanSetupService {
    hydrateInitialState(baseState) {
        const board = this.loadBoard();
        const cards = this.loadCards();
        const players = (0, _setupservicehelper.getSafePlayers)(baseState);
        const positions = {};
        const tokens = {};
        const skipTurn = {};
        const bonusReroll = {};
        for (const player of players){
            if (player?.id == null) continue;
            positions[player.id] = 0;
            tokens[player.id] = 2;
            skipTurn[player.id] = 0;
            bonusReroll[player.id] = false;
        }
        const seedMeta = this.getRuntimeMeta(baseState);
        const cardIds = (cards.cards ?? []).map((card)=>card.id);
        const shuffle = this.random.shuffle(seedMeta, cardIds);
        const metadata = {
            ...seedMeta,
            ...shuffle.meta,
            tiles: board.tiles ?? [],
            cards: cards.cards ?? [],
            deckCards: shuffle.values,
            discardCards: [],
            positions,
            tokens,
            statuses: {
                skipTurn,
                bonusReroll
            },
            pendingContext: null,
            winnerId: null
        };
        return {
            ...baseState,
            phase: 'playing',
            pending: null,
            metadata: {
                ...baseState.metadata ?? {},
                ...metadata
            }
        };
    }
    loadBoard() {
        return (0, _contentloaderhelper.loadV1Content)(this.contentLoader, {
            gameType: 'tout-pres-de-maman',
            baseDir: __dirname,
            filename: 'board.json',
            arrayField: 'tiles',
            minItems: 1
        });
    }
    loadCards() {
        return (0, _contentloaderhelper.loadV1Content)(this.contentLoader, {
            gameType: 'tout-pres-de-maman',
            baseDir: __dirname,
            filename: 'cards.json',
            arrayField: 'cards',
            minItems: 1
        });
    }
    getRuntimeMeta(state) {
        return state.metadata ?? {};
    }
    constructor(contentLoader, random){
        this.contentLoader = contentLoader;
        this.random = random;
    }
};
ToutPresDeMamanSetupService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _gamecontentloaderservice.GameContentLoaderService === "undefined" ? Object : _gamecontentloaderservice.GameContentLoaderService,
        typeof _randomservice.RandomService === "undefined" ? Object : _randomservice.RandomService
    ])
], ToutPresDeMamanSetupService);
