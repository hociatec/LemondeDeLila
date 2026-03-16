"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "MonVillageSetupService", {
    enumerable: true,
    get: function() {
        return MonVillageSetupService;
    }
});
const _common = require("@nestjs/common");
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
let MonVillageSetupService = class MonVillageSetupService {
    hydrateInitialState(base) {
        const board = this.loadBoard();
        const cards = this.loadCards();
        const players = Array.isArray(base.players) ? base.players : [];
        const positions = {};
        const statuses = {
            skipTurn: {}
        };
        const collections = {};
        for (const player of players){
            if (player?.id != null) {
                positions[player.id] = 0;
                statuses.skipTurn[player.id] = 0;
                collections[player.id] = {
                    total: 0,
                    byZone: {}
                };
            }
        }
        const seedMeta = asRecord(base.metadata);
        const decks = {};
        const discards = {};
        let shuffleSeed = seedMeta;
        for (const zone of cards.zones ?? []){
            const zoneCards = (zone.cards ?? []).map((card)=>({
                    ...card,
                    zoneId: zone.id
                }));
            const shuffled = this.random.shuffle(shuffleSeed, zoneCards);
            decks[zone.id] = shuffled.values;
            discards[zone.id] = [];
            shuffleSeed = {
                ...shuffleSeed,
                ...asRecord(shuffled.meta)
            };
        }
        const metadata = {
            tiles: board.tiles ?? [],
            positions,
            statuses,
            decks,
            discards,
            collections,
            pendingContext: null,
            winnerId: null
        };
        return {
            ...base,
            phase: 'playing',
            pending: null,
            metadata: {
                ...base.metadata ?? {},
                ...metadata
            }
        };
    }
    loadBoard() {
        return (0, _contentloaderhelper.loadV1Content)(this.contentLoader, {
            gameType: 'mon-village-mon-histoire',
            baseDir: __dirname,
            filename: 'board.json',
            arrayField: 'tiles',
            minItems: 1
        });
    }
    loadCards() {
        return (0, _contentloaderhelper.loadV1Content)(this.contentLoader, {
            gameType: 'mon-village-mon-histoire',
            baseDir: __dirname,
            filename: 'cards.json',
            arrayField: 'zones',
            minItems: 1
        });
    }
    constructor(contentLoader, random){
        this.contentLoader = contentLoader;
        this.random = random;
    }
};
MonVillageSetupService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _gamecontentloaderservice.GameContentLoaderService === "undefined" ? Object : _gamecontentloaderservice.GameContentLoaderService,
        typeof _randomservice.RandomService === "undefined" ? Object : _randomservice.RandomService
    ])
], MonVillageSetupService);
