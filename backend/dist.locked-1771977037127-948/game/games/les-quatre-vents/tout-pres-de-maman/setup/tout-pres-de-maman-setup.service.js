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
exports.ToutPresDeMamanSetupService = void 0;
const common_1 = require("@nestjs/common");
const setup_service_helper_1 = require("../../../../setup/setup-service.helper");
const game_content_loader_service_1 = require("../../../../engine/services/game-content-loader.service");
const random_service_1 = require("../../../../modules/random/services/random.service");
const content_loader_helper_1 = require("../../../../setup/content-loader.helper");
let ToutPresDeMamanSetupService = class ToutPresDeMamanSetupService {
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
        const tokens = {};
        const skipTurn = {};
        const bonusReroll = {};
        for (const player of players) {
            if (player?.id == null)
                continue;
            positions[player.id] = 0;
            tokens[player.id] = 2;
            skipTurn[player.id] = 0;
            bonusReroll[player.id] = false;
        }
        const seedMeta = this.getRuntimeMeta(baseState);
        const cardIds = (cards.cards ?? []).map((card) => card.id);
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
                bonusReroll,
            },
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
    loadBoard() {
        return (0, content_loader_helper_1.loadV1Content)(this.contentLoader, {
            gameType: 'tout-pres-de-maman',
            baseDir: __dirname,
            filename: 'board.json',
            arrayField: 'tiles',
            minItems: 1,
        });
    }
    loadCards() {
        return (0, content_loader_helper_1.loadV1Content)(this.contentLoader, {
            gameType: 'tout-pres-de-maman',
            baseDir: __dirname,
            filename: 'cards.json',
            arrayField: 'cards',
            minItems: 1,
        });
    }
    getRuntimeMeta(state) {
        return (state.metadata ?? {});
    }
};
exports.ToutPresDeMamanSetupService = ToutPresDeMamanSetupService;
exports.ToutPresDeMamanSetupService = ToutPresDeMamanSetupService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [game_content_loader_service_1.GameContentLoaderService,
        random_service_1.RandomService])
], ToutPresDeMamanSetupService);
//# sourceMappingURL=tout-pres-de-maman-setup.service.js.map