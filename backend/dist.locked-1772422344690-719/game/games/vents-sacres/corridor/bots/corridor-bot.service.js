"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "CorridorBotService", {
    enumerable: true,
    get: function() {
        return CorridorBotService;
    }
});
const _common = require("@nestjs/common");
const _botrunnerservice = require("../../../../modules/bot/services/bot-runner.service");
const _rulebook = /*#__PURE__*/ _interop_require_wildcard(require("../rulebook/rulebook"));
function _getRequireWildcardCache(nodeInterop) {
    if (typeof WeakMap !== "function") return null;
    var cacheBabelInterop = new WeakMap();
    var cacheNodeInterop = new WeakMap();
    return (_getRequireWildcardCache = function(nodeInterop) {
        return nodeInterop ? cacheNodeInterop : cacheBabelInterop;
    })(nodeInterop);
}
function _interop_require_wildcard(obj, nodeInterop) {
    if (!nodeInterop && obj && obj.__esModule) {
        return obj;
    }
    if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
        return {
            default: obj
        };
    }
    var cache = _getRequireWildcardCache(nodeInterop);
    if (cache && cache.has(obj)) {
        return cache.get(obj);
    }
    var newObj = {
        __proto__: null
    };
    var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
    for(var key in obj){
        if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
            if (desc && (desc.get || desc.set)) {
                Object.defineProperty(newObj, key, desc);
            } else {
                newObj[key] = obj[key];
            }
        }
    }
    newObj.default = obj;
    if (cache) {
        cache.set(obj, newObj);
    }
    return newObj;
}
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let CorridorBotService = class CorridorBotService {
    getBotActions(state, botPlayerId) {
        const current = state.turn?.currentPlayerId ?? null;
        if (current !== botPlayerId) return [];
        const meta = state.metadata ?? {};
        const moveTargets = _rulebook.listLegalPawnMoves(state, botPlayerId);
        const wallTargets = _rulebook.listLegalWallPlacements(state, botPlayerId);
        const moveActions = moveTargets.map((to)=>({
                type: 'corridor_move',
                payload: {
                    x: to.x,
                    y: to.y
                }
            }));
        // Heuristique simple:
        // - si un coup gagne immédiatement, le prendre
        for (const to of moveTargets){
            if (_rulebook.isWinningPos(state, botPlayerId, to)) {
                return [
                    {
                        type: 'corridor_move',
                        payload: {
                            x: to.x,
                            y: to.y
                        }
                    }
                ];
            }
        }
        // - sinon, avancer vers l’objectif (réduit la distance en Y)
        const size = meta?.size ?? 0;
        const players = state.players ?? [];
        const myIdx = players.findIndex((p)=>p?.id === botPlayerId);
        const oppId = players.find((p)=>p?.id !== botPlayerId)?.id ?? null;
        const myGoalY = myIdx === 0 ? size - 1 : 0;
        const oppGoalY = myIdx === 0 ? 0 : size - 1;
        const myPos = _rulebook.getPawnPos(meta, botPlayerId);
        const oppPos = oppId != null ? _rulebook.getPawnPos(meta, oppId) : null;
        const myDist = size && myPos ? _rulebook.shortestDistanceToGoal(meta, myPos, myGoalY) : null;
        const oppDist = size && oppPos ? _rulebook.shortestDistanceToGoal(meta, oppPos, oppGoalY) : null;
        const remaining = (meta?.wallsRemainingByPlayerId ?? {})[String(botPlayerId)] ?? 0;
        // Bot agressif:
        // 1) Anti-victoire: si l'adversaire a un coup gagnant au prochain tour, poser un mur qui l'empêche.
        if (remaining > 0 && oppId != null && oppPos != null && wallTargets.length > 0) {
            const opponentWinNow = (()=>{
                const moves = _rulebook.listLegalPawnMoves(state, oppId);
                return moves.some((m)=>_rulebook.isWinningPos(state, oppId, m));
            })();
            if (opponentWinNow) {
                const bestAntiWin = this.pickWallToPreventImmediateWin(state, meta, botPlayerId, oppId, myGoalY, oppGoalY, myPos, oppPos, wallTargets);
                if (bestAntiWin != null) {
                    return [
                        {
                            type: 'corridor_place_wall',
                            payload: {
                                x: bestAntiWin.x,
                                y: bestAntiWin.y,
                                o: bestAntiWin.o
                            }
                        }
                    ];
                }
            }
        }
        // 2) Bloquer si l'adversaire est en avance/proche du but, ou parfois pour prendre l'initiative.
        const shouldConsiderWalls = remaining > 0 && oppId != null && oppPos != null && oppDist != null && (oppDist <= 4 || myDist != null && oppDist <= myDist + 1);
        const wantAggressiveWall = shouldConsiderWalls && (oppDist <= 3 || myDist != null && oppDist < myDist || // Initiative: un peu d'aléatoire pour que le bot place aussi des murs en début de partie.
        Math.random() < 0.35);
        if (wantAggressiveWall && wallTargets.length > 0 && myPos && oppPos && myDist != null && oppDist != null) {
            const bestWall = this.pickAggressiveWall(meta, myGoalY, oppGoalY, myPos, oppPos, wallTargets);
            if (bestWall != null) {
                return [
                    {
                        type: 'corridor_place_wall',
                        payload: {
                            x: bestWall.x,
                            y: bestWall.y,
                            o: bestWall.o
                        }
                    }
                ];
            }
        }
        const bestMove = this.pickMoveByShortestPath(meta, myGoalY, myPos, moveTargets);
        if (bestMove != null) {
            return [
                {
                    type: 'corridor_move',
                    payload: {
                        x: bestMove.x,
                        y: bestMove.y
                    }
                }
            ];
        }
        const wallActions = wallTargets.map((w)=>({
                type: 'corridor_place_wall',
                payload: {
                    x: w.x,
                    y: w.y,
                    o: w.o
                }
            }));
        // Fallback: choix aléatoire, avec préférence au déplacement.
        return this.botRunner.choose([
            ...moveActions,
            ...wallActions
        ], {
            state,
            playerId: botPlayerId
        }, 'random', {
            preferTypes: [
                'corridor_move'
            ],
            fallbackTypes: [
                'corridor_move',
                'corridor_place_wall'
            ]
        });
    }
    pickMoveByShortestPath(meta, goalY, start, targets) {
        if (!start) return null;
        if (targets.length === 0) return null;
        let best = null;
        let bestDist = Number.POSITIVE_INFINITY;
        for (const t of targets){
            const d = _rulebook.shortestDistanceToGoal(meta, t, goalY);
            if (d == null) continue;
            if (d < bestDist) {
                bestDist = d;
                best = t;
            }
        }
        return best;
    }
    pickAggressiveWall(meta, myGoalY, oppGoalY, myPos, oppPos, walls) {
        const baseMy = _rulebook.shortestDistanceToGoal(meta, myPos, myGoalY);
        const baseOpp = _rulebook.shortestDistanceToGoal(meta, oppPos, oppGoalY);
        if (baseMy == null || baseOpp == null) return null;
        let best = null;
        let bestScore = 0;
        for (const w of walls){
            const tmp = _rulebook.applyWall(meta, w);
            const nextMy = _rulebook.shortestDistanceToGoal(tmp, myPos, myGoalY);
            const nextOpp = _rulebook.shortestDistanceToGoal(tmp, oppPos, oppGoalY);
            if (nextMy == null || nextOpp == null) continue;
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
        // Seuil volontairement bas: bot plus "méchant", il doit oser poser des murs.
        if (bestScore >= 2) {
            return best;
        }
        return null;
    }
    pickWallToPreventImmediateWin(state, meta, _botPlayerId, opponentId, myGoalY, oppGoalY, myPos, oppPos, walls) {
        const baseMy = _rulebook.shortestDistanceToGoal(meta, myPos, myGoalY);
        const baseOpp = _rulebook.shortestDistanceToGoal(meta, oppPos, oppGoalY);
        if (baseMy == null || baseOpp == null) return null;
        let best = null;
        let bestScore = Number.NEGATIVE_INFINITY;
        for (const w of walls){
            const tmpMeta = _rulebook.applyWall(meta, w);
            const tmpState = {
                ...state,
                metadata: tmpMeta
            };
            const canStillWin = _rulebook.listLegalPawnMoves(tmpState, opponentId).some((m)=>_rulebook.isWinningPos(tmpState, opponentId, m));
            if (canStillWin) continue;
            const nextMy = _rulebook.shortestDistanceToGoal(tmpMeta, myPos, myGoalY);
            const nextOpp = _rulebook.shortestDistanceToGoal(tmpMeta, oppPos, oppGoalY);
            if (nextMy == null || nextOpp == null) continue;
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
    constructor(botRunner){
        this.botRunner = botRunner;
    }
};
CorridorBotService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _botrunnerservice.BotRunnerService === "undefined" ? Object : _botrunnerservice.BotRunnerService
    ])
], CorridorBotService);
