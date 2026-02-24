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
exports.LamaDrawService = void 0;
const common_1 = require("@nestjs/common");
const lama_model_1 = require("../model/lama.model");
const lama_round_service_1 = require("../round/lama-round.service");
const lama_shared_service_1 = require("../shared/lama-shared.service");
const lama_log_service_1 = require("../logging/lama-log.service");
const pending_action_service_1 = require("../../../../modules/pending-action/services/pending-action.service");
let LamaDrawService = class LamaDrawService {
    shared;
    round;
    logger;
    constructor(shared, round, logger) {
        this.shared = shared;
        this.round = round;
        this.logger = logger;
    }
    applyDraw(state, meta, actorId) {
        const dropped = meta.droppedOutByPlayerId ?? {};
        const drawLocked = Object.values(dropped).some((isOut) => Boolean(isOut));
        if (drawLocked) {
            return state;
        }
        const turnIndex = Number(state.turnIndex ?? 0);
        const maxDraws = this.shared.getMaxDrawsPerTurn(meta);
        const drawCount = this.shared.getCurrentTurnDrawCount(meta, actorId, turnIndex);
        if (drawCount >= maxDraws) {
            return state;
        }
        const deck = Array.isArray(meta.deck) ? [...meta.deck] : [];
        if (deck.length <= 0)
            return state;
        const card = deck.pop();
        const handsByPlayerId = { ...(meta.handsByPlayerId ?? {}) };
        const hand = [...(handsByPlayerId[String(actorId)] ?? [])];
        hand.push(card);
        handsByPlayerId[String(actorId)] = hand;
        const players = Array.isArray(state.players) ? state.players : [];
        const name = this.shared.playerLabel(players, actorId);
        const label = (0, lama_model_1.lamaCardLabel)(card);
        const log = this.logger.append(state.log, `${name} pioche un ${label}.`);
        const nextDrawCount = drawCount + 1;
        const nextMeta = {
            ...meta,
            deck,
            handsByPlayerId,
            lastDrawTurnIndexByPlayerId: {
                ...(meta.lastDrawTurnIndexByPlayerId ?? {}),
                [String(actorId)]: turnIndex,
            },
            drawTrackerByPlayerId: {
                ...(meta.drawTrackerByPlayerId ?? {}),
                [String(actorId)]: { turnIndex, count: nextDrawCount },
            },
            turnTracker: {
                playerId: actorId,
                drawn: true,
                played: false,
                drawCount: nextDrawCount,
            },
            suppressTurnAnnouncement: false,
        };
        if (meta.allowPlayAfterDraw && nextDrawCount < maxDraws) {
            return (0, pending_action_service_1.createPendingState)({
                ...state,
                metadata: nextMeta,
                log,
                turnIndex: turnIndex + 1,
                turn: {
                    ...(state.turn ?? { direction: 1 }),
                    currentPlayerId: actorId,
                    direction: 1,
                    label: `Tour de ${name}`,
                },
            }, { step: 'turn_choice', playerId: actorId });
        }
        const nextPlayerId = this.round.findNextActivePlayerId(players, nextMeta, actorId);
        const advancedMeta = {
            ...nextMeta,
            turnTracker: {
                playerId: nextPlayerId,
                drawn: false,
                played: false,
                drawCount: 0,
            },
            suppressTurnAnnouncement: false,
        };
        const nextState = (0, pending_action_service_1.createPendingState)({
            ...state,
            metadata: advancedMeta,
            log,
            turnIndex: turnIndex + 1,
            turn: {
                ...(state.turn ?? { direction: 1 }),
                currentPlayerId: nextPlayerId,
                direction: 1,
                label: nextPlayerId
                    ? `Tour de ${this.shared.playerLabel(players, nextPlayerId)}`
                    : undefined,
            },
        }, { step: 'turn_choice', playerId: nextPlayerId });
        if (this.round.isRoundEnded(advancedMeta, players)) {
            const winnerId = this.round.findRoundWinnerId(advancedMeta, players);
            return this.round.endRound(nextState, winnerId);
        }
        return nextState;
    }
};
exports.LamaDrawService = LamaDrawService;
exports.LamaDrawService = LamaDrawService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [lama_shared_service_1.LamaSharedService,
        lama_round_service_1.LamaRoundService,
        lama_log_service_1.LamaLogService])
], LamaDrawService);
//# sourceMappingURL=lama-draw.service.js.map