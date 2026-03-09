"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "TaxiExpressSetupService", {
    enumerable: true,
    get: function() {
        return TaxiExpressSetupService;
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
let TaxiExpressSetupService = class TaxiExpressSetupService {
    hydrateInitialState(baseState) {
        const board = this.loadBoard();
        const clients = this.loadClients();
        const events = this.loadEvents();
        const players = (0, _setupservicehelper.getSafePlayers)(baseState);
        const positions = {};
        const statuses = {};
        const completedTrips = {};
        const activeClients = {};
        for (const player of players){
            if (player?.id == null) continue;
            positions[player.id] = 0;
            statuses[player.id] = 0;
            completedTrips[player.id] = 0;
            activeClients[player.id] = null;
        }
        const seedMeta = this.getRuntimeMeta(baseState);
        const clientIds = (clients.cards ?? []).map((card)=>card.id);
        const firstShuffle = this.random.shuffle(seedMeta, clientIds);
        let meta = {
            ...seedMeta,
            ...firstShuffle.meta,
            tiles: board.tiles ?? [],
            clients: clients.cards ?? [],
            events: events.cards ?? [],
            deckClients: firstShuffle.values,
            discardClients: [],
            deckEvents: [],
            discardEvents: [],
            positions,
            activeClients,
            completedTrips,
            blockedTileId: null,
            lastEventId: null,
            eventTurnPlayerId: null,
            statuses: {
                skipTurn: statuses
            },
            pendingContext: null,
            winnerId: null
        };
        const eventIds = (events.cards ?? []).map((card)=>card.id);
        const eventShuffle = this.random.shuffle(meta, eventIds);
        meta = {
            ...meta,
            ...eventShuffle.meta,
            deckEvents: eventShuffle.values,
            discardEvents: []
        };
        return {
            ...baseState,
            phase: 'playing',
            pending: null,
            metadata: {
                ...baseState.metadata ?? {},
                ...meta
            }
        };
    }
    loadBoard() {
        return (0, _contentloaderhelper.loadV1Content)(this.contentLoader, {
            gameType: 'taxi-express',
            baseDir: __dirname,
            filename: 'board.json',
            arrayField: 'tiles',
            minItems: 1
        });
    }
    loadClients() {
        return (0, _contentloaderhelper.loadV1Content)(this.contentLoader, {
            gameType: 'taxi-express',
            baseDir: __dirname,
            filename: 'clients.json',
            arrayField: 'cards',
            minItems: 1
        });
    }
    loadEvents() {
        return (0, _contentloaderhelper.loadV1Content)(this.contentLoader, {
            gameType: 'taxi-express',
            baseDir: __dirname,
            filename: 'events.json',
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
TaxiExpressSetupService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _gamecontentloaderservice.GameContentLoaderService === "undefined" ? Object : _gamecontentloaderservice.GameContentLoaderService,
        typeof _randomservice.RandomService === "undefined" ? Object : _randomservice.RandomService
    ])
], TaxiExpressSetupService);
