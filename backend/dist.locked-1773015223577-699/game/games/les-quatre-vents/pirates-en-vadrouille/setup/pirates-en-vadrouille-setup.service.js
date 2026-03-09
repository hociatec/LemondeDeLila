"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "PiratesEnVadrouilleSetupService", {
    enumerable: true,
    get: function() {
        return PiratesEnVadrouilleSetupService;
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
function asRecord(value) {
    return value != null && typeof value === 'object' ? value : {};
}
let PiratesEnVadrouilleSetupService = class PiratesEnVadrouilleSetupService {
    hydrateInitialState(baseState) {
        const board = this.loadBoard();
        const cards = this.loadCards();
        const players = (0, _setupservicehelper.getSafePlayers)(baseState);
        const positions = {};
        const statuses = {
            skipTurn: {},
            obstacleImmunity: {}
        };
        const collections = {};
        for (const player of players){
            if (player?.id != null) {
                positions[player.id] = 0;
                statuses.skipTurn[player.id] = 0;
                statuses.obstacleImmunity[player.id] = 0;
                collections[player.id] = {
                    treasures: [],
                    obstacles: [],
                    bonus: [],
                    goldPieces: 0
                };
            }
        }
        const seedMeta = asRecord(baseState.metadata);
        const shuffledTreasure = this.random.shuffle(seedMeta, cards.treasure ?? []);
        const shuffledObstacle = this.random.shuffle(shuffledTreasure.meta ?? seedMeta, cards.obstacle ?? []);
        const shuffledBonus = this.random.shuffle(shuffledObstacle.meta ?? seedMeta, cards.bonus ?? []);
        const metadata = {
            tiles: board.tiles ?? [],
            positions,
            statuses,
            decks: {
                treasure: shuffledTreasure.values,
                obstacle: shuffledObstacle.values,
                bonus: shuffledBonus.values
            },
            discards: {
                treasure: [],
                obstacle: [],
                bonus: []
            },
            collections,
            pendingContext: null,
            winnerId: null
        };
        return {
            ...baseState,
            phase: 'playing',
            pending: null,
            metadata: {
                ...baseState.metadata ?? {},
                ...shuffledTreasure.meta ?? {},
                ...shuffledObstacle.meta ?? {},
                ...shuffledBonus.meta ?? {},
                ...metadata
            }
        };
    }
    loadBoard() {
        return (0, _contentloaderhelper.loadV1Content)(this.contentLoader, {
            gameType: 'pirates-en-vadrouille',
            baseDir: __dirname,
            filename: 'board.json',
            arrayField: 'tiles',
            minItems: 1
        });
    }
    loadCards() {
        return (0, _contentloaderhelper.loadV1Content)(this.contentLoader, {
            gameType: 'pirates-en-vadrouille',
            baseDir: __dirname,
            filename: 'cards.json',
            extraValidators: [
                this.contentLoader.validators.arrayField('treasure', 1),
                this.contentLoader.validators.arrayField('obstacle', 1),
                this.contentLoader.validators.arrayField('bonus', 1)
            ]
        });
    }
    constructor(contentLoader, random){
        this.contentLoader = contentLoader;
        this.random = random;
    }
};
PiratesEnVadrouilleSetupService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _gamecontentloaderservice.GameContentLoaderService === "undefined" ? Object : _gamecontentloaderservice.GameContentLoaderService,
        typeof _randomservice.RandomService === "undefined" ? Object : _randomservice.RandomService
    ])
], PiratesEnVadrouilleSetupService);
