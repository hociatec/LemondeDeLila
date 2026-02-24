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
exports.PanierExpressPhaseService = void 0;
const common_1 = require("@nestjs/common");
const game_core_service_1 = require("../../../../core/services/game-core.service");
const victory_service_1 = require("../../../../modules/victory/services/victory.service");
const turn_flow_service_1 = require("../../../../modules/turn/services/turn-flow.service");
const action_log_service_1 = require("../../../../modules/actionlog/services/action-log.service");
const playing_logger_1 = require("../../../../../common/utils/playing-logger");
const rules_definition_1 = require("../definitions/rules.definition");
const victory_definition_1 = require("../definitions/victory.definition");
const panier_express_utils_service_1 = require("../model/panier-express-utils.service");
let PanierExpressPhaseService = class PanierExpressPhaseService {
    core;
    turns;
    victory;
    actionLogSvc;
    utils;
    phaseOrder = rules_definition_1.PANIER_EXPRESS_PHASES;
    constructor(core, turns, victory, actionLogSvc, utils) {
        this.core = core;
        this.turns = turns;
        this.victory = victory;
        this.actionLogSvc = actionLogSvc;
        this.utils = utils;
    }
    advancePhases(state) {
        let next = state;
        for (const phase of this.phaseOrder) {
            if (phase.id === 'check_victory') {
                next = this.applyVictory(next);
            }
            else if (phase.onEnter) {
                next = phase.onEnter(next);
            }
            if ((next.status || '').toLowerCase() === 'finished')
                break;
        }
        return next;
    }
    advanceTurn(state) {
        const currentId = state.turn?.currentPlayerId ?? null;
        const currentIndex = currentId != null
            ? (state.players ?? []).findIndex((p) => p.id === currentId)
            : state.turnIndex;
        const next = this.turns.advanceTurn(state);
        const meta = this.getMetadata(next);
        const statuses = meta.statuses ?? {};
        const turnFlow = meta && typeof meta === 'object' ? meta.turnFlow : null;
        const decrementMap = (input) => {
            const out = {};
            Object.entries(input ?? {}).forEach(([pid, val]) => {
                const nextVal = Math.max(0, Number(val) - 1);
                if (nextVal > 0)
                    out[Number(pid)] = nextVal;
            });
            return out;
        };
        const revealInventory = decrementMap(statuses.revealInventory);
        const revealShoppingList = decrementMap(statuses.revealShoppingList);
        const noDrawCourses = decrementMap(statuses.noDrawCourses);
        let movementDirection = meta.movementDirection === -1 ? -1 : 1;
        let movementDirectionOwnerId = typeof meta.movementDirectionOwnerId === 'number'
            ? meta.movementDirectionOwnerId
            : null;
        if (movementDirection === -1 &&
            movementDirectionOwnerId != null &&
            (next.turn?.currentPlayerId ?? null) === movementDirectionOwnerId) {
            movementDirection = 1;
            movementDirectionOwnerId = null;
        }
        const withMeta = {
            ...next,
            metadata: {
                ...next.metadata,
                movementDirection,
                movementDirectionOwnerId,
                statuses: {
                    ...statuses,
                    revealInventory,
                    revealShoppingList,
                    noDrawCourses,
                },
            },
            turn: {
                ...(next.turn ?? { currentPlayerId: null, direction: 1 }),
                direction: movementDirection,
            },
        };
        (0, playing_logger_1.playingLog)('panier.advanceTurn', {
            roomId: state.metadata?.roomId ?? null,
            gameType: state.metadata?.gameType ?? null,
            userId: currentId,
            type: 'advance_turn',
            currentId,
            currentIndex,
            nextTurnIndex: withMeta.turnIndex,
            nextCurrentPlayerId: withMeta.turn?.currentPlayerId ?? null,
            skipTurn: withMeta.metadata?.statuses?.skipTurn ?? {},
        });
        const skipped = Array.isArray(turnFlow?.skipped) ? turnFlow.skipped : [];
        if (!skipped.length) {
            return withMeta;
        }
        let out = withMeta;
        for (const entry of skipped) {
            const id = typeof entry?.id === 'number' ? entry.id : null;
            if (id == null)
                continue;
            const remaining = typeof entry?.remainingAfter === 'number' ? entry.remainingAfter : 0;
            const suffix = remaining > 0 ? ` (${remaining} restant)` : '';
            out = this.core.appendLog(out, `[Panier Express] ${this.utils.playerName(out, id)} passe son tour${suffix}.`);
        }
        const cleanedTurnFlow = {
            ...(turnFlow && typeof turnFlow === 'object' ? turnFlow : {}),
            skipped: [],
        };
        return {
            ...out,
            metadata: {
                ...out.metadata,
                turnFlow: cleanedTurnFlow,
            },
        };
    }
    applyVictory(state) {
        if ((state.status || '').toLowerCase() === 'finished')
            return state;
        const meta = this.getMetadata(state);
        const result = this.victory.evaluate(state, victory_definition_1.PANIER_EXPRESS_VICTORY);
        if (!result || !result.finished)
            return state;
        const winnerId = typeof result.winnerId === 'number' ? result.winnerId : meta.winnerId;
        const nextMeta = {
            ...meta,
            winnerId: winnerId ?? null,
        };
        const nextState = {
            ...state,
            metadata: nextMeta,
            status: 'finished',
        };
        const winnerName = winnerId != null
            ? this.utils.playerName(state, winnerId)
            : 'Partie terminée';
        const logged = this.core.appendLog(nextState, `[Panier Express] ${winnerName} remporte la partie !`);
        return this.appendActionLog(logged, winnerId ?? null, 'victory', {
            conditionId: result.conditionId,
        });
    }
    appendActionLog(state, actorId, type, payload) {
        const meta = this.getMetadata(state);
        const actionLog = this.actionLogSvc.append(meta.actionLog, {
            actorId,
            type,
            payload,
        });
        return { ...state, metadata: { ...meta, actionLog } };
    }
    getMetadata(state) {
        return state.metadata;
    }
};
exports.PanierExpressPhaseService = PanierExpressPhaseService;
exports.PanierExpressPhaseService = PanierExpressPhaseService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [game_core_service_1.GameCoreService,
        turn_flow_service_1.TurnFlowService,
        victory_service_1.VictoryService,
        action_log_service_1.ActionLogService,
        panier_express_utils_service_1.PanierExpressUtils])
], PanierExpressPhaseService);
//# sourceMappingURL=panier-express-phase.service.js.map