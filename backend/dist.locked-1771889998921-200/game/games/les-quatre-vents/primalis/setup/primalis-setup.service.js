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
exports.PrimalisSetupService = void 0;
const common_1 = require("@nestjs/common");
const setup_service_helper_1 = require("../../../../setup/setup-service.helper");
const game_content_loader_service_1 = require("../../../../engine/services/game-content-loader.service");
const content_loader_helper_1 = require("../../../../setup/content-loader.helper");
let PrimalisSetupService = class PrimalisSetupService {
    contentLoader;
    constructor(contentLoader) {
        this.contentLoader = contentLoader;
    }
    hydrateInitialState(baseState) {
        const board = this.loadBoard();
        const players = (0, setup_service_helper_1.getSafePlayers)(baseState);
        const positions = {};
        const collections = {};
        for (const player of players) {
            if (player?.id != null) {
                positions[player.id] = 0;
                collections[player.id] = this.initialResources();
            }
        }
        const metadata = {
            tiles: board.tiles ?? [],
            positions,
            statuses: { dangerAmplified: false },
            collections,
            pendingContext: null,
            winnerId: null,
        };
        return {
            ...baseState,
            phase: 'playing',
            pending: null,
            metadata: { ...(baseState.metadata ?? {}), ...metadata },
        };
    }
    initialResources() {
        return {
            herbivores: 2,
            carnivores: 0,
            eggs: 0,
            leaves: 2,
        };
    }
    loadBoard() {
        return (0, content_loader_helper_1.loadV1Content)(this.contentLoader, {
            gameType: 'primalis',
            baseDir: __dirname,
            filename: '../model/content/board.json',
            arrayField: 'tiles',
            minItems: 1,
        });
    }
};
exports.PrimalisSetupService = PrimalisSetupService;
exports.PrimalisSetupService = PrimalisSetupService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [game_content_loader_service_1.GameContentLoaderService])
], PrimalisSetupService);
//# sourceMappingURL=primalis-setup.service.js.map