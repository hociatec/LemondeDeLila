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
exports.LamaPassService = void 0;
const common_1 = require("@nestjs/common");
const lama_round_service_1 = require("../round/lama-round.service");
const lama_shared_service_1 = require("../shared/lama-shared.service");
const lama_log_service_1 = require("../logging/lama-log.service");
const pending_action_service_1 = require("../../../../modules/pending-action/services/pending-action.service");
let LamaPassService = class LamaPassService {
    shared;
    round;
    logger;
    constructor(shared, round, logger) {
        this.shared = shared;
        this.round = round;
        this.logger = logger;
    }
    applyPass(state, meta, actorId) {
        if (!meta.allowPlayAfterDraw)
            return state;
        const tracker = meta.turnTracker ?? {
            playerId: actorId,
            drawn: false,
            played: false,
        };
        if (this.shared.asNumberOrNull(tracker.playerId) !== actorId ||
            !this.shared.asBoolean(tracker.drawn) ||
            this.shared.asBoolean(tracker.played)) {
            return state;
        }
        const players = Array.isArray(state.players) ? state.players : [];
        const name = this.shared.playerLabel(players, actorId);
        const log = this.logger.append(state.log, `${name} passe.`);
        const nextPlayerId = this.round.findNextActivePlayerId(players, meta, actorId);
        const nextMeta = {
            ...meta,
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
            metadata: nextMeta,
            log,
            turnIndex: (state.turnIndex ?? 0) + 1,
            turn: {
                ...(state.turn ?? { direction: 1 }),
                currentPlayerId: nextPlayerId,
                direction: 1,
                label: nextPlayerId
                    ? `Tour de ${this.shared.playerLabel(players, nextPlayerId)}`
                    : undefined,
            },
        }, { step: 'turn_choice', playerId: nextPlayerId });
        if (this.round.isRoundEnded(nextMeta, players)) {
            const winnerId = this.round.findRoundWinnerId(nextMeta, players);
            return this.round.endRound(nextState, winnerId);
        }
        return nextState;
    }
};
exports.LamaPassService = LamaPassService;
exports.LamaPassService = LamaPassService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [lama_shared_service_1.LamaSharedService,
        lama_round_service_1.LamaRoundService,
        lama_log_service_1.LamaLogService])
], LamaPassService);
//# sourceMappingURL=lama-pass.service.js.map