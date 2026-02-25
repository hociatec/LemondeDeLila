"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "LamaReturnService", {
    enumerable: true,
    get: function() {
        return LamaReturnService;
    }
});
const _common = require("@nestjs/common");
const _lamasharedservice = require("../shared/lama-shared.service");
const _lamaroundservice = require("../round/lama-round.service");
const _lamalogservice = require("../logging/lama-log.service");
const _pendingactionservice = require("../../../../modules/pending-action/services/pending-action.service");
const _payloadvalidatorshelper = require("../../../../core/helpers/payload-validators.helper");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let LamaReturnService = class LamaReturnService {
    applyReturnToken(state, meta, actorId, action) {
        if (meta.pendingReturnPlayerId !== actorId) {
            return state;
        }
        if (String(action.type ?? '') !== 'lama_return') {
            return state;
        }
        const value = (()=>{
            try {
                return (0, _payloadvalidatorshelper.optionalInt)(action.payload ?? {}, 'value') ?? 0;
            } catch  {
                return 0;
            }
        })();
        const currentScore = Number((meta.scoresByPlayerId ?? {})[String(actorId)] ?? 0);
        const delta = value === 10 ? 10 : value === 1 ? 1 : 0;
        const nextScore = Math.max(0, currentScore - delta);
        const scoresByPlayerId = {
            ...meta.scoresByPlayerId ?? {}
        };
        scoresByPlayerId[String(actorId)] = nextScore;
        const players = Array.isArray(state.players) ? state.players : [];
        const name = this.shared.playerLabel(players, actorId);
        let log = state.log;
        if (delta === 10) log = this.logger.append(log, `${name} rend 1 diamant (10 jetons).`);
        else if (delta === 1) log = this.logger.append(log, `${name} rend 1 jeton.`);
        else log = this.logger.append(log, `${name} ne rend rien.`);
        const queue = Array.isArray(meta.pendingReturnQueue) ? [
            ...meta.pendingReturnQueue
        ] : [];
        const remaining = queue.filter((id)=>id !== actorId);
        const nextPending = remaining.length ? remaining[0] : null;
        const nextMeta = {
            ...meta,
            scoresByPlayerId,
            pendingReturnQueue: remaining,
            pendingReturnPlayerId: nextPending,
            step: nextPending ? 'return_token' : 'turn_choice',
            suppressTurnAnnouncement: false
        };
        const nextState = (0, _pendingactionservice.createPendingState)({
            ...state,
            metadata: nextMeta,
            log,
            turnIndex: (state.turnIndex ?? 0) + 1,
            turn: {
                ...state.turn ?? {
                    direction: 1
                },
                currentPlayerId: nextPending ?? state.turn?.currentPlayerId ?? null,
                direction: 1,
                label: nextPending ? `Rendre des jetons : ${this.shared.playerLabel(players, nextPending)}` : undefined
            }
        }, {
            step: nextMeta.step,
            playerId: nextMeta.pendingReturnPlayerId ?? null
        });
        if (nextPending) {
            return nextState;
        }
        return this.round.finishRoundAndMaybeStartNext(nextState);
    }
    constructor(shared, round, logger){
        this.shared = shared;
        this.round = round;
        this.logger = logger;
    }
};
LamaReturnService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _lamasharedservice.LamaSharedService === "undefined" ? Object : _lamasharedservice.LamaSharedService,
        typeof _lamaroundservice.LamaRoundService === "undefined" ? Object : _lamaroundservice.LamaRoundService,
        typeof _lamalogservice.LamaLogService === "undefined" ? Object : _lamalogservice.LamaLogService
    ])
], LamaReturnService);
