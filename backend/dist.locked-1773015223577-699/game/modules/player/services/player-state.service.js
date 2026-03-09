"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "PlayerStateService", {
    enumerable: true,
    get: function() {
        return PlayerStateService;
    }
});
const _common = require("@nestjs/common");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let PlayerStateService = class PlayerStateService {
    isAlive(state, playerId) {
        if (playerId == null) return false;
        const player = (state.players ?? []).find((p)=>p.id === playerId);
        return Boolean(player && player.alive !== false);
    }
    kill(state, playerId) {
        const players = (state.players ?? []).map((p)=>p.id === playerId ? {
                ...p,
                alive: false
            } : p);
        return {
            ...state,
            players
        };
    }
    livingIds(state) {
        return (state.players ?? []).filter((p)=>p.alive !== false).map((p)=>p.id).filter((id)=>typeof id === 'number');
    }
    ensureAliveFlag(players) {
        return (players ?? []).map((p)=>({
                ...p,
                alive: p.alive ?? true
            }));
    }
};
PlayerStateService = _ts_decorate([
    (0, _common.Injectable)()
], PlayerStateService);
