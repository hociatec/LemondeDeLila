"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CorridorBotService = void 0;
const common_1 = require("@nestjs/common");
const bot_runner_service_1 = require("../../../../modules/bot/services/bot-runner.service");
const CorridorRulebook = __importStar(require("../rulebook/rulebook"));
let CorridorBotService = class CorridorBotService {
    botRunner;
    constructor(botRunner) {
        this.botRunner = botRunner;
    }
    getBotActions(state, botPlayerId) {
        const current = state.turn?.currentPlayerId ?? null;
        if (current !== botPlayerId)
            return [];
        const meta = (state.metadata ?? {});
        const moveTargets = CorridorRulebook.listLegalPawnMoves(state, botPlayerId);
        const wallTargets = CorridorRulebook.listLegalWallPlacements(state, botPlayerId);
        const moveActions = moveTargets.map((to) => ({
            type: 'corridor_move',
            payload: { x: to.x, y: to.y },
        }));
        for (const to of moveTargets) {
            if (CorridorRulebook.isWinningPos(state, botPlayerId, to)) {
                return [{ type: 'corridor_move', payload: { x: to.x, y: to.y } }];
            }
        }
        const size = meta?.size ?? 0;
        const players = state.players ?? [];
        const myIdx = players.findIndex((p) => p?.id === botPlayerId);
        const oppId = players.find((p) => p?.id !== botPlayerId)?.id ?? null;
        const myGoalY = myIdx === 0 ? size - 1 : 0;
        const oppGoalY = myIdx === 0 ? 0 : size - 1;
        const myPos = CorridorRulebook.getPawnPos(meta, botPlayerId);
        const oppPos = oppId != null ? CorridorRulebook.getPawnPos(meta, oppId) : null;
        const myDist = size && myPos
            ? CorridorRulebook.shortestDistanceToGoal(meta, myPos, myGoalY)
            : null;
        const oppDist = size && oppPos
            ? CorridorRulebook.shortestDistanceToGoal(meta, oppPos, oppGoalY)
            : null;
        const remaining = (meta?.wallsRemainingByPlayerId ?? {})[String(botPlayerId)] ?? 0;
        if (remaining > 0 &&
            oppId != null &&
            oppPos != null &&
            wallTargets.length > 0) {
            const opponentWinNow = (() => {
                const moves = CorridorRulebook.listLegalPawnMoves(state, oppId);
                return moves.some((m) => CorridorRulebook.isWinningPos(state, oppId, m));
            })();
            if (opponentWinNow) {
                const bestAntiWin = this.pickWallToPreventImmediateWin(state, meta, botPlayerId, oppId, myGoalY, oppGoalY, myPos, oppPos, wallTargets);
                if (bestAntiWin != null) {
                    return [
                        {
                            type: 'corridor_place_wall',
                            payload: { x: bestAntiWin.x, y: bestAntiWin.y, o: bestAntiWin.o },
                        },
                    ];
                }
            }
        }
        const shouldConsiderWalls = remaining > 0 &&
            oppId != null &&
            oppPos != null &&
            oppDist != null &&
            (oppDist <= 4 || (myDist != null && oppDist <= myDist + 1));
        const wantAggressiveWall = shouldConsiderWalls &&
            (oppDist <= 3 ||
                (myDist != null && oppDist < myDist) ||
                Math.random() < 0.35);
        if (wantAggressiveWall &&
            wallTargets.length > 0 &&
            myPos &&
            oppPos &&
            myDist != null &&
            oppDist != null) {
            const bestWall = this.pickAggressiveWall(meta, myGoalY, oppGoalY, myPos, oppPos, wallTargets);
            if (bestWall != null) {
                return [
                    {
                        type: 'corridor_place_wall',
                        payload: { x: bestWall.x, y: bestWall.y, o: bestWall.o },
                    },
                ];
            }
        }
        const bestMove = this.pickMoveByShortestPath(meta, myGoalY, myPos, moveTargets);
        if (bestMove != null) {
            return [
                { type: 'corridor_move', payload: { x: bestMove.x, y: bestMove.y } },
            ];
        }
        const wallActions = wallTargets.map((w) => ({
            type: 'corridor_place_wall',
            payload: { x: w.x, y: w.y, o: w.o },
        }));
        return this.botRunner.choose([...moveActions, ...wallActions], { state, playerId: botPlayerId }, 'random', {
            preferTypes: ['corridor_move'],
            fallbackTypes: ['corridor_move', 'corridor_place_wall'],
        });
    }
    pickMoveByShortestPath(meta, goalY, start, targets) {
        if (!start)
            return null;
        if (targets.length === 0)
            return null;
        let best = null;
        let bestDist = Number.POSITIVE_INFINITY;
        for (const t of targets) {
            const d = CorridorRulebook.shortestDistanceToGoal(meta, t, goalY);
            if (d == null)
                continue;
            if (d < bestDist) {
                bestDist = d;
                best = t;
            }
        }
        return best;
    }
    pickAggressiveWall(meta, myGoalY, oppGoalY, myPos, oppPos, walls) {
        const baseMy = CorridorRulebook.shortestDistanceToGoal(meta, myPos, myGoalY);
        const baseOpp = CorridorRulebook.shortestDistanceToGoal(meta, oppPos, oppGoalY);
        if (baseMy == null || baseOpp == null)
            return null;
        let best = null;
        let bestScore = 0;
        for (const w of walls) {
            const tmp = CorridorRulebook.applyWall(meta, w);
            const nextMy = CorridorRulebook.shortestDistanceToGoal(tmp, myPos, myGoalY);
            const nextOpp = CorridorRulebook.shortestDistanceToGoal(tmp, oppPos, oppGoalY);
            if (nextMy == null || nextOpp == null)
                continue;
            const oppGain = nextOpp - baseOpp;
            const myGain = nextMy - baseMy;
            const proximity = Math.abs(w.x - oppPos.x) + Math.abs(w.y - oppPos.y);
            const proximityBonus = proximity <= 1 ? 2 : proximity <= 2 ? 1 : 0;
            const score = oppGain * 4 - myGain * 2 + proximityBonus;
            if (score > bestScore && oppGain >= 1 && myGain <= 3) {
                bestScore = score;
                best = w;
            }
        }
        if (bestScore >= 2) {
            return best;
        }
        return null;
    }
    pickWallToPreventImmediateWin(state, meta, _botPlayerId, opponentId, myGoalY, oppGoalY, myPos, oppPos, walls) {
        const baseMy = CorridorRulebook.shortestDistanceToGoal(meta, myPos, myGoalY);
        const baseOpp = CorridorRulebook.shortestDistanceToGoal(meta, oppPos, oppGoalY);
        if (baseMy == null || baseOpp == null)
            return null;
        let best = null;
        let bestScore = Number.NEGATIVE_INFINITY;
        for (const w of walls) {
            const tmpMeta = CorridorRulebook.applyWall(meta, w);
            const tmpState = {
                ...state,
                metadata: tmpMeta,
            };
            const canStillWin = CorridorRulebook.listLegalPawnMoves(tmpState, opponentId).some((m) => CorridorRulebook.isWinningPos(tmpState, opponentId, m));
            if (canStillWin)
                continue;
            const nextMy = CorridorRulebook.shortestDistanceToGoal(tmpMeta, myPos, myGoalY);
            const nextOpp = CorridorRulebook.shortestDistanceToGoal(tmpMeta, oppPos, oppGoalY);
            if (nextMy == null || nextOpp == null)
                continue;
            const oppGain = nextOpp - baseOpp;
            const myGain = nextMy - baseMy;
            const score = oppGain * 5 - myGain * 2;
            if (score > bestScore) {
                bestScore = score;
                best = w;
            }
        }
        return best;
    }
};
exports.CorridorBotService = CorridorBotService;
exports.CorridorBotService = CorridorBotService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [bot_runner_service_1.BotRunnerService])
], CorridorBotService);
//# sourceMappingURL=corridor-bot.service.js.map