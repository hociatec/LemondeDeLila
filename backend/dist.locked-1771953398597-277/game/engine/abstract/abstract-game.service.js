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
exports.AbstractGameService = void 0;
const common_1 = require("@nestjs/common");
const game_registry_service_1 = require("../services/game-registry.service");
let AbstractGameService = class AbstractGameService {
    registry;
    constructor(registry) {
        this.registry = registry;
    }
    onModuleInit() {
        this.registry.register(this);
    }
    extractActorId(action) {
        const meta = action.meta;
        if (!meta || typeof meta !== 'object') {
            return null;
        }
        const actorValue = meta['actorId'];
        return typeof actorValue === 'number' ? actorValue : null;
    }
    isPlayerBot(playerId, state) {
        const player = (state.players ?? []).find((p) => p.id === playerId);
        return player?.isBot ?? false;
    }
    setBotThinkingFlag(state) {
        const currentId = state.turn?.currentPlayerId ?? null;
        if (currentId === null) {
            return { ...state, botThinking: false };
        }
        const isBot = this.isPlayerBot(currentId, state);
        return { ...state, botThinking: isBot };
    }
    findPlayer(playerId, state) {
        const players = state.players ?? [];
        return players.find((p) => p.id === playerId) ?? null;
    }
    getCurrentPlayer(state) {
        const currentId = state.turn?.currentPlayerId ?? null;
        if (currentId === null)
            return null;
        return this.findPlayer(currentId, state);
    }
    isStarted(state) {
        return (state.status || '').toLowerCase() === 'started';
    }
    isFinished(state) {
        return (state.status || '').toLowerCase() === 'finished';
    }
    shouldAnnounceBoardArrivals() {
        return false;
    }
};
exports.AbstractGameService = AbstractGameService;
exports.AbstractGameService = AbstractGameService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [game_registry_service_1.GameRegistryService])
], AbstractGameService);
//# sourceMappingURL=abstract-game.service.js.map