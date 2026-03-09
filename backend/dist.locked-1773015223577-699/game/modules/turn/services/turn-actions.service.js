"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "TurnActionsService", {
    enumerable: true,
    get: function() {
        return TurnActionsService;
    }
});
const _common = require("@nestjs/common");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let TurnActionsService = class TurnActionsService {
    buildAvailableActions(params) {
        const { state, playerId, pending, base } = params;
        if (state.status === 'finished') return [];
        const current = state.turn?.currentPlayerId ?? null;
        if (current !== playerId) return [];
        if (pending) {
            // si une action obligatoire est en attente, on ne propose rien d’autre ici
            return base ?? [];
        }
        return base ?? [];
    }
};
TurnActionsService = _ts_decorate([
    (0, _common.Injectable)()
], TurnActionsService);
