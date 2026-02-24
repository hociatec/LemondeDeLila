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
exports.VoyageSetupService = void 0;
const common_1 = require("@nestjs/common");
const game_content_loader_service_1 = require("../../../../engine/services/game-content-loader.service");
const random_service_1 = require("../../../../modules/random/services/random.service");
const content_loader_helper_1 = require("../../../../setup/content-loader.helper");
let VoyageSetupService = class VoyageSetupService {
    contentLoader;
    random;
    constructor(contentLoader, random) {
        this.contentLoader = contentLoader;
        this.random = random;
    }
    hydrateInitialState(base) {
        const board = this.loadBoard();
        const legend = this.loadCards('legend-cards.json');
        const farce = this.loadCards('farce-cards.json');
        const treasure = this.loadCards('treasure-cards.json');
        const landscape = this.loadCards('landscape-cards.json');
        const players = Array.isArray(base.players) ? base.players : [];
        const positions = {};
        const collections = {};
        for (const p of players) {
            positions[p.id] = 0;
            collections[p.id] = { legend: 0, farce: 0, treasure: 0, landscape: 0 };
        }
        const seedMeta = this.getRuntimeMeta(base);
        const s1 = this.random.shuffle(seedMeta, legend.cards ?? []);
        const s2 = this.random.shuffle(s1.meta, farce.cards ?? []);
        const s3 = this.random.shuffle(s2.meta, treasure.cards ?? []);
        const s4 = this.random.shuffle(s3.meta, landscape.cards ?? []);
        const meta = {
            tiles: board.tiles ?? [],
            positions,
            statuses: { skipTurn: {}, lastTargetByActor: {} },
            decks: {
                legend: { cards: s1.values, discard: [] },
                farce: { cards: s2.values, discard: [] },
                treasure: { cards: s3.values, discard: [] },
                landscape: { cards: s4.values, discard: [] },
            },
            collections,
            pendingQuiz: null,
            finishCountdown: null,
            winnerId: null,
        };
        return {
            ...base,
            phase: 'playing',
            pending: null,
            metadata: {
                ...(base.metadata ?? {}),
                ...s4.meta,
                ...meta,
            },
        };
    }
    loadBoard() {
        return (0, content_loader_helper_1.loadV1Content)(this.contentLoader, {
            gameType: 'voyage-en-terre-de-brumes',
            baseDir: __dirname,
            filename: 'board.json',
            arrayField: 'tiles',
            minItems: 1,
        });
    }
    loadCards(filename) {
        return (0, content_loader_helper_1.loadV1Content)(this.contentLoader, {
            gameType: 'voyage-en-terre-de-brumes',
            baseDir: __dirname,
            filename,
            arrayField: 'cards',
            minItems: 1,
        });
    }
    getRuntimeMeta(state) {
        return (state.metadata ?? {});
    }
};
exports.VoyageSetupService = VoyageSetupService;
exports.VoyageSetupService = VoyageSetupService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [game_content_loader_service_1.GameContentLoaderService,
        random_service_1.RandomService])
], VoyageSetupService);
//# sourceMappingURL=voyage-setup.service.js.map