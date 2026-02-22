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
exports.MonVillageSetupService = void 0;
const common_1 = require("@nestjs/common");
const game_content_loader_service_1 = require("../../../../engine/services/game-content-loader.service");
const random_service_1 = require("../../../../modules/random/services/random.service");
const content_loader_helper_1 = require("../../../../setup/content-loader.helper");
function asRecord(value) {
    return value != null && typeof value === 'object'
        ? value
        : {};
}
let MonVillageSetupService = class MonVillageSetupService {
    contentLoader;
    random;
    constructor(contentLoader, random) {
        this.contentLoader = contentLoader;
        this.random = random;
    }
    hydrateInitialState(base) {
        const board = this.loadBoard();
        const cards = this.loadCards();
        const players = Array.isArray(base.players) ? base.players : [];
        const positions = {};
        const statuses = { skipTurn: {} };
        const collections = {};
        for (const player of players) {
            if (player?.id != null) {
                positions[player.id] = 0;
                statuses.skipTurn[player.id] = 0;
                collections[player.id] = { total: 0, byZone: {} };
            }
        }
        const seedMeta = asRecord(base.metadata);
        const decks = {};
        const discards = {};
        let shuffleSeed = seedMeta;
        for (const zone of cards.zones ?? []) {
            const zoneCards = (zone.cards ?? []).map((card) => ({
                ...card,
                zoneId: zone.id,
            }));
            const shuffled = this.random.shuffle(shuffleSeed, zoneCards);
            decks[zone.id] = shuffled.values;
            discards[zone.id] = [];
            shuffleSeed = { ...shuffleSeed, ...asRecord(shuffled.meta) };
        }
        const metadata = {
            tiles: board.tiles ?? [],
            positions,
            statuses,
            decks,
            discards,
            collections,
            pendingContext: null,
            winnerId: null,
        };
        return {
            ...base,
            phase: 'playing',
            pending: null,
            metadata: { ...(base.metadata ?? {}), ...metadata },
        };
    }
    loadBoard() {
        return (0, content_loader_helper_1.loadV1Content)(this.contentLoader, {
            gameType: 'mon-village-mon-histoire',
            baseDir: __dirname,
            filename: 'board.json',
            arrayField: 'tiles',
            minItems: 1,
        });
    }
    loadCards() {
        return (0, content_loader_helper_1.loadV1Content)(this.contentLoader, {
            gameType: 'mon-village-mon-histoire',
            baseDir: __dirname,
            filename: 'cards.json',
            arrayField: 'zones',
            minItems: 1,
        });
    }
};
exports.MonVillageSetupService = MonVillageSetupService;
exports.MonVillageSetupService = MonVillageSetupService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [game_content_loader_service_1.GameContentLoaderService,
        random_service_1.RandomService])
], MonVillageSetupService);
//# sourceMappingURL=mon-village-setup.service.js.map