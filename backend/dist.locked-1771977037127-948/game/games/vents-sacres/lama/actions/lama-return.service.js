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
exports.LamaReturnService = void 0;
const common_1 = require("@nestjs/common");
const lama_shared_service_1 = require("../shared/lama-shared.service");
const lama_round_service_1 = require("../round/lama-round.service");
const lama_log_service_1 = require("../logging/lama-log.service");
const pending_action_service_1 = require("../../../../modules/pending-action/services/pending-action.service");
const payload_validators_helper_1 = require("../../../../core/helpers/payload-validators.helper");
let LamaReturnService = class LamaReturnService {
    shared;
    round;
    logger;
    constructor(shared, round, logger) {
        this.shared = shared;
        this.round = round;
        this.logger = logger;
    }
    applyReturnToken(state, meta, actorId, action) {
        if (meta.pendingReturnPlayerId !== actorId) {
            return state;
        }
        if (String(action.type ?? '') !== 'lama_return') {
            return state;
        }
        const value = (() => {
            try {
                return (0, payload_validators_helper_1.optionalInt)(action.payload ?? {}, 'value') ?? 0;
            }
            catch {
                return 0;
            }
        })();
        const currentScore = Number((meta.scoresByPlayerId ?? {})[String(actorId)] ?? 0);
        const delta = value === 10 ? 10 : value === 1 ? 1 : 0;
        const nextScore = Math.max(0, currentScore - delta);
        const scoresByPlayerId = { ...(meta.scoresByPlayerId ?? {}) };
        scoresByPlayerId[String(actorId)] = nextScore;
        const players = Array.isArray(state.players) ? state.players : [];
        const name = this.shared.playerLabel(players, actorId);
        let log = state.log;
        if (delta === 10)
            log = this.logger.append(log, `${name} rend 1 diamant (10 jetons).`);
        else if (delta === 1)
            log = this.logger.append(log, `${name} rend 1 jeton.`);
        else
            log = this.logger.append(log, `${name} ne rend rien.`);
        const queue = Array.isArray(meta.pendingReturnQueue)
            ? [...meta.pendingReturnQueue]
            : [];
        const remaining = queue.filter((id) => id !== actorId);
        const nextPending = remaining.length ? remaining[0] : null;
        const nextMeta = {
            ...meta,
            scoresByPlayerId,
            pendingReturnQueue: remaining,
            pendingReturnPlayerId: nextPending,
            step: nextPending ? 'return_token' : 'turn_choice',
            suppressTurnAnnouncement: false,
        };
        const nextState = (0, pending_action_service_1.createPendingState)({
            ...state,
            metadata: nextMeta,
            log,
            turnIndex: (state.turnIndex ?? 0) + 1,
            turn: {
                ...(state.turn ?? { direction: 1 }),
                currentPlayerId: nextPending ?? state.turn?.currentPlayerId ?? null,
                direction: 1,
                label: nextPending
                    ? `Rendre des jetons : ${this.shared.playerLabel(players, nextPending)}`
                    : undefined,
            },
        }, {
            step: nextMeta.step,
            playerId: nextMeta.pendingReturnPlayerId ?? null,
        });
        if (nextPending) {
            return nextState;
        }
        return this.round.finishRoundAndMaybeStartNext(nextState);
    }
};
exports.LamaReturnService = LamaReturnService;
exports.LamaReturnService = LamaReturnService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [lama_shared_service_1.LamaSharedService,
        lama_round_service_1.LamaRoundService,
        lama_log_service_1.LamaLogService])
], LamaReturnService);
//# sourceMappingURL=lama-return.service.js.map