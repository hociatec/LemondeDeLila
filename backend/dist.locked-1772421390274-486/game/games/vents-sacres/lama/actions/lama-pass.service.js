"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "LamaPassService", {
    enumerable: true,
    get: function() {
        return LamaPassService;
    }
});
const _common = require("@nestjs/common");
const _lamaroundservice = require("../round/lama-round.service");
const _lamasharedservice = require("../shared/lama-shared.service");
const _lamalogservice = require("../logging/lama-log.service");
const _pendingactionservice = require("../../../../modules/pending-action/services/pending-action.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let LamaPassService = class LamaPassService {
    applyPass(state, meta, actorId) {
        if (!meta.allowPlayAfterDraw) return state;
        const tracker = meta.turnTracker ?? {
            playerId: actorId,
            drawn: false,
            played: false
        };
        if (this.shared.asNumberOrNull(tracker.playerId) !== actorId || !this.shared.asBoolean(tracker.drawn) || this.shared.asBoolean(tracker.played)) {
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
                played: false
            },
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
                currentPlayerId: nextPlayerId,
                direction: 1,
                label: nextPlayerId ? `Tour de ${this.shared.playerLabel(players, nextPlayerId)}` : undefined
            }
        }, {
            step: 'turn_choice',
            playerId: nextPlayerId
        });
        if (this.round.isRoundEnded(nextMeta, players)) {
            const winnerId = this.round.findRoundWinnerId(nextMeta, players);
            return this.round.endRound(nextState, winnerId);
        }
        return nextState;
    }
    constructor(shared, round, logger){
        this.shared = shared;
        this.round = round;
        this.logger = logger;
    }
};
LamaPassService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _lamasharedservice.LamaSharedService === "undefined" ? Object : _lamasharedservice.LamaSharedService,
        typeof _lamaroundservice.LamaRoundService === "undefined" ? Object : _lamaroundservice.LamaRoundService,
        typeof _lamalogservice.LamaLogService === "undefined" ? Object : _lamalogservice.LamaLogService
    ])
], LamaPassService);
