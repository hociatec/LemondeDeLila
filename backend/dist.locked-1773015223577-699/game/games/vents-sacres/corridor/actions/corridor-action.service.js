"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "CorridorActionService", {
    enumerable: true,
    get: function() {
        return CorridorActionService;
    }
});
const _common = require("@nestjs/common");
const _rulebook = /*#__PURE__*/ _interop_require_wildcard(require("../rulebook/rulebook"));
const _actionservicehelper = require("../../../../actions/action-service.helper");
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
let CorridorActionService = class CorridorActionService {
    appendUniqueLogMessages(state, messages) {
        let out = state;
        for (const raw of messages){
            const message = String(raw ?? '').trim();
            if (!message) continue;
            const last = out.log?.[out.log.length - 1]?.message;
            if (String(last ?? '').trim() === message) continue;
            out = {
                ...out,
                log: [
                    ...out.log ?? [],
                    {
                        message,
                        timestamp: new Date().toISOString()
                    }
                ]
            };
        }
        return out;
    }
    toCellRef(pos, size) {
        const col = CorridorActionService.toColumnLetters((pos?.x ?? 0) + 1);
        const row = Math.max(1, size - (pos?.y ?? 0));
        return `${col}${row}`.toLowerCase();
    }
    static toColumnLetters(column) {
        let n = Math.max(1, Math.floor(Number(column) || 1));
        let out = '';
        while(n > 0){
            n -= 1;
            out = String.fromCharCode(65 + n % 26) + out;
            n = Math.floor(n / 26);
        }
        return out;
    }
    applyActions(state, actions) {
        return (0, _actionservicehelper.applyActionsSequentially)((0, _actionservicehelper.harmonizeActionStateReturn)(state), actions, (next, action)=>this.applyOne((0, _actionservicehelper.harmonizeActionStateReturn)(next), action));
    }
    applyOne(state, action) {
        if (String(state.status ?? '').toLowerCase() !== 'started') {
            return state;
        }
        const actorId = typeof action?.meta?.actorId === 'number' ? action.meta.actorId : state.turn?.currentPlayerId ?? null;
        const type = (0, _actionservicehelper.normalizeLowerActionType)(action);
        const pendingType = String(state.pending?.type ?? '').trim().toLowerCase();
        if (pendingType === 'choose_pawn' && type !== 'choose_pawn') {
            return state;
        }
        return (0, _actionservicehelper.dispatchByActionType)(type, {
            choose_pawn: ()=>this.applyChoosePawn(state, action, actorId),
            corridor_move: ()=>this.applyMove(state, action, actorId),
            corridor_place_wall: ()=>this.applyWall(state, action, actorId)
        }, ()=>state);
    }
    applyChoosePawn(state, action, actorId) {
        if (actorId == null) return state;
        if (String(state.pending?.type ?? '').trim().toLowerCase() !== 'choose_pawn') {
            return state;
        }
        const pendingPlayerId = state.pending?.playerId ?? null;
        if (pendingPlayerId !== actorId) {
            return state;
        }
        const pawnId = String(action.payload?.pawnId ?? action.payload?.pawn ?? action.payload?.id ?? '').trim();
        if (!pawnId) return state;
        const meta = state.metadata ?? {};
        const allPawns = Array.isArray(meta?.pawns) ? meta.pawns : [];
        const pawnByPlayerId = {
            ...meta?.pawnByPlayerId ?? {}
        };
        if (pawnByPlayerId[String(actorId)]) return state;
        if (Object.values(pawnByPlayerId).includes(pawnId)) return state;
        const chosen = allPawns.find((p)=>String(p?.id ?? '').trim() === pawnId);
        if (!chosen) return state;
        pawnByPlayerId[String(actorId)] = pawnId;
        const withBotsAssigned = this.autoAssignBotPawns(state.players ?? [], allPawns, pawnByPlayerId);
        const nextPendingPlayer = (state.players ?? []).find((p)=>p?.isBot !== true && !withBotsAssigned[String(p.id)])?.id;
        const starterId = typeof meta.setupStarterId === 'number' ? meta.setupStarterId : state.players?.[0]?.id ?? actorId;
        const starter = (state.players ?? []).find((p)=>p?.id === starterId) ?? null;
        const nextTurnPlayerId = nextPendingPlayer ?? starterId;
        const nextMeta = {
            ...meta,
            pawnByPlayerId: withBotsAssigned
        };
        const actorName = (state.players ?? []).find((p)=>p?.id === actorId)?.username ?? `#${actorId}`;
        const nextWithLog = this.appendUniqueLogMessages(state, [
            `${actorName} choisit ${chosen.label}.`
        ]);
        return {
            ...nextWithLog,
            metadata: {
                ...nextWithLog.metadata ?? {},
                ...nextMeta
            },
            pending: nextPendingPlayer != null ? {
                type: 'choose_pawn',
                label: 'Votre pion.',
                playerId: nextPendingPlayer,
                blocking: true,
                data: {
                    pawns: allPawns.filter((p)=>!Object.values(withBotsAssigned).includes(String(p.id))).map((p)=>({
                            id: p.id,
                            label: `${p.label} - ${String(p.description ?? '').trim()}`,
                            description: p.description
                        }))
                }
            } : null,
            turn: {
                ...nextWithLog.turn ?? {
                    direction: 1
                },
                currentPlayerId: nextTurnPlayerId,
                direction: 1,
                label: nextPendingPlayer != null ? 'Choix du pion' : `Tour de ${starter?.username ?? 'joueur'}`
            }
        };
    }
    autoAssignBotPawns(players, pawns, pawnByPlayerId) {
        const out = {
            ...pawnByPlayerId
        };
        const used = new Set(Object.values(out));
        for (const bot of players.filter((p)=>p?.isBot === true)){
            if (out[String(bot.id)]) continue;
            const pick = pawns.find((p)=>!used.has(String(p.id)));
            if (!pick) break;
            out[String(bot.id)] = String(pick.id);
            used.add(String(pick.id));
        }
        return out;
    }
    applyMove(state, action, actorId) {
        return (0, _actionservicehelper.applyActionPipeline)(state, action, {
            guard: ()=>actorId != null,
            validate: (current, currentAction)=>_rulebook.validateMoveAction(current, currentAction, actorId),
            transition: (current, _currentAction, validatedMove)=>{
                const { to, actorId: validatedActor } = validatedMove;
                const meta = current.metadata ?? {};
                const from = _rulebook.getPawnPos(meta, validatedActor);
                const size = Number(meta?.size ?? 0) || 9;
                const nextMeta = {
                    ...meta,
                    pawnsByPlayerId: {
                        ...meta.pawnsByPlayerId ?? {},
                        [String(validatedActor)]: {
                            x: to.x,
                            y: to.y
                        }
                    }
                };
                return {
                    actorId: validatedActor,
                    metadata: nextMeta,
                    moveMessage: `se deplace de ${this.toCellRef(from, size)} a ${this.toCellRef(to, size)}`,
                    maybeWinnerPos: to
                };
            },
            effects: (current, _currentAction, _validatedMove, transitioned)=>this.advanceTurnAndMaybeFinish(current, transitioned.actorId, transitioned.metadata, {
                    moveMessage: transitioned.moveMessage,
                    maybeWinnerPos: transitioned.maybeWinnerPos
                })
        });
    }
    applyWall(state, action, actorId) {
        return (0, _actionservicehelper.applyActionPipeline)(state, action, {
            guard: ()=>actorId != null,
            validate: (current, currentAction)=>_rulebook.validatePlaceWallAction(current, currentAction, actorId),
            transition: (current, _currentAction, validatedWall)=>{
                const { wall, actorId: validatedActor } = validatedWall;
                const meta = current.metadata ?? {};
                const size = Number(meta?.size ?? 0) || 9;
                const remaining = (meta?.wallsRemainingByPlayerId ?? {})[String(validatedActor)] ?? 0;
                const nextMeta = {
                    ..._rulebook.applyWall(meta, wall),
                    wallsRemainingByPlayerId: {
                        ...meta?.wallsRemainingByPlayerId ?? {},
                        [String(validatedActor)]: Math.max(0, remaining - 1)
                    }
                };
                const at = this.toCellRef({
                    x: wall.x,
                    y: wall.y
                }, size);
                const orientation = wall.o === 'h' ? 'horizontal' : 'vertical';
                return {
                    actorId: validatedActor,
                    metadata: nextMeta,
                    moveMessage: `place un mur ${orientation} en ${at}`,
                    maybeWinnerPos: null
                };
            },
            effects: (current, _currentAction, _validatedWall, transitioned)=>this.advanceTurnAndMaybeFinish(current, transitioned.actorId, transitioned.metadata, {
                    moveMessage: transitioned.moveMessage,
                    maybeWinnerPos: transitioned.maybeWinnerPos
                })
        });
    }
    advanceTurnAndMaybeFinish(state, actorId, nextMeta, options) {
        const players = state.players ?? [];
        const actor = players.find((p)=>p?.id === actorId);
        const other = players.find((p)=>p?.id !== actorId);
        const nextPlayerId = other?.id ?? actorId;
        const won = options.maybeWinnerPos != null ? _rulebook.isWinningPos(state, actorId, options.maybeWinnerPos) : false;
        const safeMeta = {
            ...nextMeta
        };
        if (won) {
            safeMeta.winnerPlayerId = actorId;
            safeMeta.winnerId = actorId;
        } else {
            safeMeta.winnerPlayerId = null;
            safeMeta.winnerId = null;
            delete safeMeta.finishedAt;
            delete safeMeta.outcomesByPlayerId;
        }
        const status = won ? 'finished' : state.status;
        const actorName = actor?.username ?? `#${actorId}`;
        const moveMsg = `${actorName} ${options.moveMessage}.`;
        const winMsg = won ? `Victoire de ${actorName}.` : null;
        const nextWithLogs = this.appendUniqueLogMessages(state, [
            moveMsg,
            ...winMsg ? [
                winMsg
            ] : []
        ]);
        return {
            ...nextWithLogs,
            status,
            metadata: safeMeta,
            turnIndex: (state.turnIndex ?? 0) + 1,
            turn: won ? {
                ...nextWithLogs.turn ?? {
                    currentPlayerId: null,
                    direction: 1
                },
                currentPlayerId: null
            } : {
                ...nextWithLogs.turn ?? {
                    currentPlayerId: nextPlayerId,
                    direction: 1
                },
                currentPlayerId: nextPlayerId,
                label: `Tour de ${other?.username ?? 'joueur'}`
            }
        };
    }
};
CorridorActionService = _ts_decorate([
    (0, _common.Injectable)()
], CorridorActionService);
