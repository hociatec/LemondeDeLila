"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "TurnFlowService", {
    enumerable: true,
    get: function() {
        return TurnFlowService;
    }
});
const _common = require("@nestjs/common");
const _turnservice = require("./turn.service");
const _turnpoliciesservice = require("../../turn-policies/services/turn-policies.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let TurnFlowService = class TurnFlowService {
    advanceTurn(state, options) {
        const players = Array.isArray(state.players) ? state.players : [];
        if (!players.length) return state;
        const meta = state.metadata ?? {};
        const statuses = meta.statuses ?? {};
        const skipTurn = statuses.skipTurn ?? {};
        const currentId = state.turn?.currentPlayerId ?? null;
        const currentIndex = currentId != null ? players.findIndex((p)=>p?.id === currentId) : state.turnIndex;
        const next = this.turns.nextTurn(players, currentIndex >= 0 ? currentIndex : state.turnIndex, skipTurn);
        const skipped = Array.isArray(next.skipped) ? next.skipped : [];
        const turnFlow = meta && typeof meta === 'object' && !Array.isArray(meta) ? meta.turnFlow : null;
        const nextTurnFlow = skipped.length > 0 ? {
            ...turnFlow && typeof turnFlow === 'object' && !Array.isArray(turnFlow) ? turnFlow : {},
            skipped
        } : turnFlow;
        let result = {
            ...state,
            turnIndex: next.turnIndex,
            turn: {
                currentPlayerId: next.currentPlayerId,
                direction: 1
            },
            metadata: {
                ...meta,
                statuses: {
                    ...statuses,
                    skipTurn: next.skipTurn
                },
                ...nextTurnFlow ? {
                    turnFlow: nextTurnFlow
                } : {}
            }
        };
        if (!(options?.skipAnnouncement ?? false)) {
            const playerId = result.turn?.currentPlayerId ?? null;
            result = this.turnPolicies.appendTurnAnnouncement(result, playerId, options?.playerNameResolver);
        }
        return result;
    }
    constructor(turns, turnPolicies){
        this.turns = turns;
        this.turnPolicies = turnPolicies;
    }
};
TurnFlowService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _turnservice.TurnService === "undefined" ? Object : _turnservice.TurnService,
        typeof _turnpoliciesservice.TurnPoliciesService === "undefined" ? Object : _turnpoliciesservice.TurnPoliciesService
    ])
], TurnFlowService);
