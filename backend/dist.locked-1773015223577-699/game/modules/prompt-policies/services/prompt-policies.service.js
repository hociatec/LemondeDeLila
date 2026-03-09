"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "PromptPoliciesService", {
    enumerable: true,
    get: function() {
        return PromptPoliciesService;
    }
});
const _common = require("@nestjs/common");
const _gamecoreservice = require("../../../core/services/game-core.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let PromptPoliciesService = class PromptPoliciesService {
    appendLogOnce(state, message) {
        const log = Array.isArray(state.log) ? state.log : [];
        const last = String(log[log.length - 1]?.message ?? '').trim();
        const normalizedMessage = String(message ?? '').trim();
        if (!normalizedMessage || last === normalizedMessage) return state;
        return this.core.appendLog(state, normalizedMessage);
    }
    ensurePendingPlayerPrompt(state, pendingType, buildMessage) {
        const pending = state.pending;
        if (!pending || pending.type !== pendingType) return state;
        const chooserId = typeof pending.playerId === 'number' ? pending.playerId : state.turn?.currentPlayerId ?? null;
        if (chooserId == null) return state;
        return this.appendLogOnce(state, buildMessage(chooserId));
    }
    constructor(core){
        this.core = core;
    }
};
PromptPoliciesService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _gamecoreservice.GameCoreService === "undefined" ? Object : _gamecoreservice.GameCoreService
    ])
], PromptPoliciesService);
