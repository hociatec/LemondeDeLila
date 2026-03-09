"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "LamaQuitService", {
    enumerable: true,
    get: function() {
        return LamaQuitService;
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
let LamaQuitService = class LamaQuitService {
    applyQuit(state, meta, actorId) {
        const droppedOutByPlayerId = {
            ...meta.droppedOutByPlayerId ?? {}
        };
        if (droppedOutByPlayerId[String(actorId)]) return state;
        droppedOutByPlayerId[String(actorId)] = true;
        const players = Array.isArray(state.players) ? state.players : [];
        const name = this.shared.playerLabel(players, actorId);
        let log = this.logger.append(state.log, `${name} se retire de la manche.`);
        log = this.logger.append(log, `${name} ne jouera plus ; ses jetons seront comptés à la fin de la manche.`);
        const nextMeta = {
            ...meta,
            droppedOutByPlayerId,
            suppressTurnAnnouncement: false
        };
        const nextStateBase = {
            ...state,
            metadata: nextMeta,
            log
        };
        const roundNumber = Number(meta.roundNumber ?? 0);
        const alreadyLoggedRoundEnd = roundNumber > 0 && Array.isArray(state.log) && state.log.some((l)=>String(l?.message ?? '') === `Fin de la manche ${roundNumber}.`);
        if (alreadyLoggedRoundEnd) {
            const winnerId = this.round.findRoundWinnerId(nextMeta, players);
            return this.round.endRound(nextStateBase, winnerId);
        }
        if (this.round.isRoundEnded(nextMeta, players)) {
            const winnerId = this.round.findRoundWinnerId(nextMeta, players);
            return this.round.endRound(nextStateBase, winnerId);
        }
        const nextPlayerId = this.round.findNextActivePlayerId(players, nextMeta, actorId);
        return (0, _pendingactionservice.createPendingState)({
            ...nextStateBase,
            turnIndex: (state.turnIndex ?? 0) + 1,
            metadata: {
                ...nextMeta,
                turnTracker: {
                    playerId: nextPlayerId,
                    drawn: false,
                    played: false
                }
            },
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
    }
    constructor(shared, round, logger){
        this.shared = shared;
        this.round = round;
        this.logger = logger;
    }
};
LamaQuitService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _lamasharedservice.LamaSharedService === "undefined" ? Object : _lamasharedservice.LamaSharedService,
        typeof _lamaroundservice.LamaRoundService === "undefined" ? Object : _lamaroundservice.LamaRoundService,
        typeof _lamalogservice.LamaLogService === "undefined" ? Object : _lamalogservice.LamaLogService
    ])
], LamaQuitService);
