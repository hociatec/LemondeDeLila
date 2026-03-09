"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "TurnManagerService", {
    enumerable: true,
    get: function() {
        return TurnManagerService;
    }
});
const _common = require("@nestjs/common");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let TurnManagerService = class TurnManagerService {
    setCurrent(state, playerId) {
        return {
            ...state,
            turn: {
                currentPlayerId: playerId,
                direction: state.turn?.direction ?? 1
            }
        };
    }
    next(state, livingIds, offset = 1) {
        if (!livingIds.length) return this.setCurrent(state, null);
        const currentId = state.turn?.currentPlayerId ?? null;
        const idx = currentId == null ? -1 : livingIds.indexOf(currentId);
        const nextIdx = idx < 0 ? 0 : (idx + offset) % livingIds.length;
        return this.setCurrent(state, livingIds[nextIdx] ?? null);
    }
};
TurnManagerService = _ts_decorate([
    (0, _common.Injectable)()
], TurnManagerService);
