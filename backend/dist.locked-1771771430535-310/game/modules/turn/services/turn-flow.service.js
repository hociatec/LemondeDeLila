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
exports.TurnFlowService = void 0;
const common_1 = require("@nestjs/common");
const turn_service_1 = require("./turn.service");
const turn_policies_service_1 = require("../../turn-policies/services/turn-policies.service");
let TurnFlowService = class TurnFlowService {
    turns;
    turnPolicies;
    constructor(turns, turnPolicies) {
        this.turns = turns;
        this.turnPolicies = turnPolicies;
    }
    advanceTurn(state, options) {
        const players = Array.isArray(state.players) ? state.players : [];
        if (!players.length)
            return state;
        const meta = state.metadata ?? {};
        const statuses = meta.statuses ?? {};
        const skipTurn = statuses.skipTurn ?? {};
        const currentId = state.turn?.currentPlayerId ?? null;
        const currentIndex = currentId != null
            ? players.findIndex((p) => p?.id === currentId)
            : state.turnIndex;
        const next = this.turns.nextTurn(players, currentIndex >= 0 ? currentIndex : state.turnIndex, skipTurn);
        const skipped = Array.isArray(next.skipped)
            ? next.skipped
            : [];
        const turnFlow = meta && typeof meta === 'object' && !Array.isArray(meta)
            ? meta.turnFlow
            : null;
        const nextTurnFlow = skipped.length > 0
            ? {
                ...(turnFlow &&
                    typeof turnFlow === 'object' &&
                    !Array.isArray(turnFlow)
                    ? turnFlow
                    : {}),
                skipped,
            }
            : turnFlow;
        let result = {
            ...state,
            turnIndex: next.turnIndex,
            turn: { currentPlayerId: next.currentPlayerId, direction: 1 },
            metadata: {
                ...meta,
                statuses: { ...statuses, skipTurn: next.skipTurn },
                ...(nextTurnFlow ? { turnFlow: nextTurnFlow } : {}),
            },
        };
        if (!(options?.skipAnnouncement ?? false)) {
            const playerId = result.turn?.currentPlayerId ?? null;
            result = this.turnPolicies.appendTurnAnnouncement(result, playerId, options?.playerNameResolver);
        }
        return result;
    }
};
exports.TurnFlowService = TurnFlowService;
exports.TurnFlowService = TurnFlowService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [turn_service_1.TurnService,
        turn_policies_service_1.TurnPoliciesService])
], TurnFlowService);
//# sourceMappingURL=turn-flow.service.js.map