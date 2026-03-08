"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "PrimalisSetupService", {
    enumerable: true,
    get: function() {
        return PrimalisSetupService;
    }
});
const _common = require("@nestjs/common");
const _setupservicehelper = require("../../../../setup/setup-service.helper");
const _gamecontentloaderservice = require("../../../../engine/services/game-content-loader.service");
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
let PrimalisSetupService = class PrimalisSetupService {
    hydrateInitialState(baseState) {
        const board = this.loadBoard();
        const players = (0, _setupservicehelper.getSafePlayers)(baseState);
        const positions = {};
        const collections = {};
        for (const player of players){
            if (player?.id != null) {
                positions[player.id] = 0;
                collections[player.id] = this.initialResources();
            }
        }
        const metadata = {
            tiles: board.tiles ?? [],
            positions,
            statuses: {
                dangerAmplified: false
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
                ...metadata
            }
        };
    }
    initialResources() {
        return {
            herbivores: 2,
            carnivores: 0,
            eggs: 0,
            leaves: 2
        };
    }
    loadBoard() {
        return (0, _contentloaderhelper.loadV1Content)(this.contentLoader, {
            gameType: 'primalis',
            baseDir: __dirname,
            filename: '../model/content/board.json',
            arrayField: 'tiles',
            minItems: 1
        });
    }
    constructor(contentLoader){
        this.contentLoader = contentLoader;
    }
};
PrimalisSetupService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _gamecontentloaderservice.GameContentLoaderService === "undefined" ? Object : _gamecontentloaderservice.GameContentLoaderService
    ])
], PrimalisSetupService);
