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
        const actorId = state.turn?.currentPlayerId ?? null;
        const type = (0, _actionservicehelper.normalizeLowerActionType)(action);
        return (0, _actionservicehelper.dispatchByActionType)(type, {
            corridor_move: ()=>this.applyMove(state, action, actorId),
            corridor_place_wall: ()=>this.applyWall(state, action, actorId)
        }, ()=>state);
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
                    moveMessage: `se déplace de ${this.toCellRef(from, size)} à ${this.toCellRef(to, size)}`,
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
        const status = won ? 'finished' : state.status;
        if (won) {
            nextMeta.winnerPlayerId = actorId;
            nextMeta.winnerId = actorId;
        }
        const actorName = actor?.username ?? `#${actorId}`;
        const moveMsg = `${actorName} ${options.moveMessage}.`;
        const winMsg = won ? `Victoire de ${actorName}.` : null;
        return {
            ...state,
            status,
            metadata: nextMeta,
            turnIndex: (state.turnIndex ?? 0) + 1,
            log: [
                ...state.log ?? [],
                {
                    message: moveMsg
                },
                ...winMsg ? [
                    {
                        message: winMsg
                    }
                ] : []
            ],
            turn: won ? {
                ...state.turn ?? {
                    currentPlayerId: null,
                    direction: 1
                },
                currentPlayerId: null
            } : {
                ...state.turn ?? {
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
