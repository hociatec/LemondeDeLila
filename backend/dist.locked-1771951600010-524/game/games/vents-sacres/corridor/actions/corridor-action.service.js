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
var CorridorActionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CorridorActionService = void 0;
const common_1 = require("@nestjs/common");
const CorridorRulebook = __importStar(require("../rulebook/rulebook"));
const action_service_helper_1 = require("../../../../actions/action-service.helper");
let CorridorActionService = CorridorActionService_1 = class CorridorActionService {
    toCellRef(pos, size) {
        const col = CorridorActionService_1.toColumnLetters((pos?.x ?? 0) + 1);
        const row = Math.max(1, size - (pos?.y ?? 0));
        return `${col}${row}`.toLowerCase();
    }
    static toColumnLetters(column) {
        let n = Math.max(1, Math.floor(Number(column) || 1));
        let out = '';
        while (n > 0) {
            n -= 1;
            out = String.fromCharCode(65 + (n % 26)) + out;
            n = Math.floor(n / 26);
        }
        return out;
    }
    applyActions(state, actions) {
        return (0, action_service_helper_1.applyActionsSequentially)((0, action_service_helper_1.harmonizeActionStateReturn)(state), actions, (next, action) => this.applyOne((0, action_service_helper_1.harmonizeActionStateReturn)(next), action));
    }
    applyOne(state, action) {
        if (String(state.status ?? '').toLowerCase() !== 'started') {
            return state;
        }
        const actorId = state.turn?.currentPlayerId ?? null;
        const type = (0, action_service_helper_1.normalizeLowerActionType)(action);
        return (0, action_service_helper_1.dispatchByActionType)(type, {
            corridor_move: () => this.applyMove(state, action, actorId),
            corridor_place_wall: () => this.applyWall(state, action, actorId),
        }, () => state);
    }
    applyMove(state, action, actorId) {
        return (0, action_service_helper_1.applyActionPipeline)(state, action, {
            guard: () => actorId != null,
            validate: (current, currentAction) => CorridorRulebook.validateMoveAction(current, currentAction, actorId),
            transition: (current, _currentAction, validatedMove) => {
                const { to, actorId: validatedActor } = validatedMove;
                const meta = (current.metadata ?? {});
                const from = CorridorRulebook.getPawnPos(meta, validatedActor);
                const size = Number(meta?.size ?? 0) || 9;
                const nextMeta = {
                    ...meta,
                    pawnsByPlayerId: {
                        ...(meta.pawnsByPlayerId ?? {}),
                        [String(validatedActor)]: { x: to.x, y: to.y },
                    },
                };
                return {
                    actorId: validatedActor,
                    metadata: nextMeta,
                    moveMessage: `se déplace de ${this.toCellRef(from, size)} à ${this.toCellRef(to, size)}`,
                    maybeWinnerPos: to,
                };
            },
            effects: (current, _currentAction, _validatedMove, transitioned) => this.advanceTurnAndMaybeFinish(current, transitioned.actorId, transitioned.metadata, {
                moveMessage: transitioned.moveMessage,
                maybeWinnerPos: transitioned.maybeWinnerPos,
            }),
        });
    }
    applyWall(state, action, actorId) {
        return (0, action_service_helper_1.applyActionPipeline)(state, action, {
            guard: () => actorId != null,
            validate: (current, currentAction) => CorridorRulebook.validatePlaceWallAction(current, currentAction, actorId),
            transition: (current, _currentAction, validatedWall) => {
                const { wall, actorId: validatedActor } = validatedWall;
                const meta = (current.metadata ?? {});
                const size = Number(meta?.size ?? 0) || 9;
                const remaining = (meta?.wallsRemainingByPlayerId ?? {})[String(validatedActor)] ?? 0;
                const nextMeta = {
                    ...CorridorRulebook.applyWall(meta, wall),
                    wallsRemainingByPlayerId: {
                        ...(meta?.wallsRemainingByPlayerId ?? {}),
                        [String(validatedActor)]: Math.max(0, remaining - 1),
                    },
                };
                const at = this.toCellRef({ x: wall.x, y: wall.y }, size);
                const orientation = wall.o === 'h' ? 'horizontal' : 'vertical';
                return {
                    actorId: validatedActor,
                    metadata: nextMeta,
                    moveMessage: `place un mur ${orientation} en ${at}`,
                    maybeWinnerPos: null,
                };
            },
            effects: (current, _currentAction, _validatedWall, transitioned) => this.advanceTurnAndMaybeFinish(current, transitioned.actorId, transitioned.metadata, {
                moveMessage: transitioned.moveMessage,
                maybeWinnerPos: transitioned.maybeWinnerPos,
            }),
        });
    }
    advanceTurnAndMaybeFinish(state, actorId, nextMeta, options) {
        const players = state.players ?? [];
        const actor = players.find((p) => p?.id === actorId);
        const other = players.find((p) => p?.id !== actorId);
        const nextPlayerId = other?.id ?? actorId;
        const won = options.maybeWinnerPos != null
            ? CorridorRulebook.isWinningPos(state, actorId, options.maybeWinnerPos)
            : false;
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
                ...(state.log ?? []),
                { message: moveMsg },
                ...(winMsg ? [{ message: winMsg }] : []),
            ],
            turn: won
                ? {
                    ...(state.turn ?? { currentPlayerId: null, direction: 1 }),
                    currentPlayerId: null,
                }
                : {
                    ...(state.turn ?? { currentPlayerId: nextPlayerId, direction: 1 }),
                    currentPlayerId: nextPlayerId,
                    label: `Tour de ${other?.username ?? 'joueur'}`,
                },
        };
    }
};
exports.CorridorActionService = CorridorActionService;
exports.CorridorActionService = CorridorActionService = CorridorActionService_1 = __decorate([
    (0, common_1.Injectable)()
], CorridorActionService);
//# sourceMappingURL=corridor-action.service.js.map