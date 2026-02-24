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
exports.PiratesEnVadrouilleSetupService = void 0;
const common_1 = require("@nestjs/common");
const setup_service_helper_1 = require("../../../../setup/setup-service.helper");
const game_content_loader_service_1 = require("../../../../engine/services/game-content-loader.service");
const random_service_1 = require("../../../../modules/random/services/random.service");
const content_loader_helper_1 = require("../../../../setup/content-loader.helper");
function asRecord(value) {
    return value != null && typeof value === 'object'
        ? value
        : {};
}
let PiratesEnVadrouilleSetupService = class PiratesEnVadrouilleSetupService {
    contentLoader;
    random;
    constructor(contentLoader, random) {
        this.contentLoader = contentLoader;
        this.random = random;
    }
    hydrateInitialState(baseState) {
        const board = this.loadBoard();
        const cards = this.loadCards();
        const players = (0, setup_service_helper_1.getSafePlayers)(baseState);
        const positions = {};
        const statuses = { skipTurn: {}, obstacleImmunity: {} };
        const collections = {};
        for (const player of players) {
            if (player?.id != null) {
                positions[player.id] = 0;
                statuses.skipTurn[player.id] = 0;
                statuses.obstacleImmunity[player.id] = 0;
                collections[player.id] = {
                    treasures: [],
                    obstacles: [],
                    bonus: [],
                    goldPieces: 0,
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
                bonus: shuffledBonus.values,
            },
            discards: { treasure: [], obstacle: [], bonus: [] },
            collections,
            pendingContext: null,
            winnerId: null,
        };
        return {
            ...baseState,
            phase: 'playing',
            pending: null,
            metadata: {
                ...(baseState.metadata ?? {}),
                ...(shuffledTreasure.meta ?? {}),
                ...(shuffledObstacle.meta ?? {}),
                ...(shuffledBonus.meta ?? {}),
                ...metadata,
            },
        };
    }
    loadBoard() {
        return (0, content_loader_helper_1.loadV1Content)(this.contentLoader, {
            gameType: 'pirates-en-vadrouille',
            baseDir: __dirname,
            filename: '../model/content/board.json',
            arrayField: 'tiles',
            minItems: 1,
        });
    }
    loadCards() {
        return (0, content_loader_helper_1.loadV1Content)(this.contentLoader, {
            gameType: 'pirates-en-vadrouille',
            baseDir: __dirname,
            filename: '../model/content/cards.json',
            extraValidators: [
                this.contentLoader.validators.arrayField('treasure', 1),
                this.contentLoader.validators.arrayField('obstacle', 1),
                this.contentLoader.validators.arrayField('bonus', 1),
            ],
        });
    }
};
exports.PiratesEnVadrouilleSetupService = PiratesEnVadrouilleSetupService;
exports.PiratesEnVadrouilleSetupService = PiratesEnVadrouilleSetupService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [game_content_loader_service_1.GameContentLoaderService,
        random_service_1.RandomService])
], PiratesEnVadrouilleSetupService);
//# sourceMappingURL=pirates-en-vadrouille-setup.service.js.map