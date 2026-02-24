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
exports.PromptPoliciesService = void 0;
const common_1 = require("@nestjs/common");
const game_core_service_1 = require("../../../core/services/game-core.service");
let PromptPoliciesService = class PromptPoliciesService {
    core;
    constructor(core) {
        this.core = core;
    }
    appendLogOnce(state, message) {
        const log = Array.isArray(state.log) ? state.log : [];
        const last = String(log[log.length - 1]?.message ?? '').trim();
        const normalizedMessage = String(message ?? '').trim();
        if (!normalizedMessage || last === normalizedMessage)
            return state;
        return this.core.appendLog(state, normalizedMessage);
    }
    ensurePendingPlayerPrompt(state, pendingType, buildMessage) {
        const pending = state.pending;
        if (!pending || pending.type !== pendingType)
            return state;
        const chooserId = typeof pending.playerId === 'number'
            ? pending.playerId
            : (state.turn?.currentPlayerId ?? null);
        if (chooserId == null)
            return state;
        return this.appendLogOnce(state, buildMessage(chooserId));
    }
};
exports.PromptPoliciesService = PromptPoliciesService;
exports.PromptPoliciesService = PromptPoliciesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [game_core_service_1.GameCoreService])
], PromptPoliciesService);
//# sourceMappingURL=prompt-policies.service.js.map