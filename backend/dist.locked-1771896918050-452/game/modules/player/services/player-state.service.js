"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayerStateService = void 0;
const common_1 = require("@nestjs/common");
let PlayerStateService = class PlayerStateService {
    isAlive(state, playerId) {
        if (playerId == null)
            return false;
        const player = (state.players ?? []).find((p) => p.id === playerId);
        return Boolean(player && player.alive !== false);
    }
    kill(state, playerId) {
        const players = (state.players ?? []).map((p) => p.id === playerId ? { ...p, alive: false } : p);
        return { ...state, players };
    }
    livingIds(state) {
        return (state.players ?? [])
            .filter((p) => p.alive !== false)
            .map((p) => p.id)
            .filter((id) => typeof id === 'number');
    }
    ensureAliveFlag(players) {
        return (players ?? []).map((p) => ({
            ...p,
            alive: p.alive ?? true,
        }));
    }
};
exports.PlayerStateService = PlayerStateService;
exports.PlayerStateService = PlayerStateService = __decorate([
    (0, common_1.Injectable)()
], PlayerStateService);
//# sourceMappingURL=player-state.service.js.map