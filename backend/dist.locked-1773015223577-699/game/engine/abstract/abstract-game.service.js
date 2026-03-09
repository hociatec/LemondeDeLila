"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "AbstractGameService", {
    enumerable: true,
    get: function() {
        return AbstractGameService;
    }
});
const _common = require("@nestjs/common");
const _gameregistryservice = require("../services/game-registry.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let AbstractGameService = class AbstractGameService {
    /**
   * Registers this game service with the game registry on module initialization.
   * This method is identical across all game services.
   */ onModuleInit() {
        this.registry.register(this);
    }
    // ============================================================================
    // COMMON UTILITY METHODS
    // ============================================================================
    /**
   * Extracts the actor ID from an action's metadata.
   * Returns null if not present or invalid.
   */ extractActorId(action) {
        const meta = action.meta;
        if (!meta || typeof meta !== 'object') {
            return null;
        }
        const actorValue = meta['actorId'];
        return typeof actorValue === 'number' ? actorValue : null;
    }
    /**
   * Checks if a player with the given ID is a bot in the current state.
   */ isPlayerBot(playerId, state) {
        const player = (state.players ?? []).find((p)=>p.id === playerId);
        return player?.isBot ?? false;
    }
    /**
   * Sets the botThinking flag based on whether the current player is a bot.
   * This is a common pattern across all game services.
   */ setBotThinkingFlag(state) {
        const currentId = state.turn?.currentPlayerId ?? null;
        if (currentId === null) {
            return {
                ...state,
                botThinking: false
            };
        }
        const isBot = this.isPlayerBot(currentId, state);
        return {
            ...state,
            botThinking: isBot
        };
    }
    /**
   * Finds a player by ID in the current state.
   * Returns null if not found.
   */ findPlayer(playerId, state) {
        const players = state.players ?? [];
        return players.find((p)=>p.id === playerId) ?? null;
    }
    /**
   * Gets the current player from the state.
   * Returns null if no current player or player not found.
   */ getCurrentPlayer(state) {
        const currentId = state.turn?.currentPlayerId ?? null;
        if (currentId === null) return null;
        return this.findPlayer(currentId, state);
    }
    /**
   * Checks if the game has started (status is 'started').
   */ isStarted(state) {
        return (state.status || '').toLowerCase() === 'started';
    }
    /**
   * Checks if the game is finished (status is 'finished').
   */ isFinished(state) {
        return (state.status || '').toLowerCase() === 'finished';
    }
    shouldAnnounceBoardArrivals() {
        return false;
    }
    constructor(registry){
        this.registry = registry;
    }
};
AbstractGameService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _gameregistryservice.GameRegistryService === "undefined" ? Object : _gameregistryservice.GameRegistryService
    ])
], AbstractGameService);
