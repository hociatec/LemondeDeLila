"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "LamaPlayService", {
    enumerable: true,
    get: function() {
        return LamaPlayService;
    }
});
const _common = require("@nestjs/common");
const _lamamodel = require("../model/lama.model");
const _lamaroundservice = require("../round/lama-round.service");
const _lamasharedservice = require("../shared/lama-shared.service");
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
let LamaPlayService = class LamaPlayService {
    applyPlay(state, meta, actorId, action) {
        const tracker = meta.turnTracker ?? {
            playerId: actorId,
            drawn: false,
            played: false
        };
        if (this.shared.asNumberOrNull(tracker.playerId) === actorId && this.shared.asBoolean(tracker.played)) {
            return state;
        }
        const rawValue = (()=>{
            try {
                return (0, _payloadvalidatorshelper.requiredInt)(action.payload ?? {}, 'value');
            } catch  {
                return 0;
            }
        })();
        const value = rawValue >= 1 && rawValue <= 7 ? rawValue : 0;
        const count = 1;
        const discard = Array.isArray(meta.discard) ? [
            ...meta.discard
        ] : [];
        const top = discard.length ? discard[discard.length - 1] : null;
        if (!top) return state;
        const allowed = new Set([
            top,
            (0, _lamamodel.nextLamaValue)(top)
        ]);
        if (!allowed.has(value)) return state;
        const handsByPlayerId = {
            ...meta.handsByPlayerId ?? {}
        };
        const hand = [
            ...handsByPlayerId[String(actorId)] ?? []
        ];
        const availableCount = hand.filter((v)=>v === value).length;
        if (availableCount < count) return state;
        let removed = 0;
        const nextHand = [];
        for (const v of hand){
            if (v === value && removed < count) {
                removed += 1;
                continue;
            }
            nextHand.push(v);
        }
        handsByPlayerId[String(actorId)] = nextHand;
        for(let i = 0; i < count; i += 1){
            discard.push(value);
        }
        const players = Array.isArray(state.players) ? state.players : [];
        const name = this.shared.playerLabel(players, actorId);
        const label = (0, _lamamodel.lamaCardLabel)(value);
        const log = this.logger.append(state.log, `${name} joue un ${label}.`);
        const nextMeta = {
            ...meta,
            handsByPlayerId,
            discard,
            turnTracker: {
                playerId: actorId,
                drawn: tracker.drawn,
                played: true
            },
            suppressTurnAnnouncement: false
        };
        if (nextHand.length === 0) {
            const endedState = {
                ...state,
                metadata: nextMeta,
                log,
                turnIndex: (state.turnIndex ?? 0) + 1
            };
            return this.round.endRound(endedState, actorId);
        }
        const nextPlayerId = this.round.findNextActivePlayerId(players, nextMeta, actorId);
        const nextState = (0, _pendingactionservice.createPendingState)({
            ...state,
            metadata: {
                ...nextMeta,
                turnTracker: {
                    playerId: nextPlayerId,
                    drawn: false,
                    played: false
                },
                suppressTurnAnnouncement: false
            },
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
LamaPlayService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _lamasharedservice.LamaSharedService === "undefined" ? Object : _lamasharedservice.LamaSharedService,
        typeof _lamaroundservice.LamaRoundService === "undefined" ? Object : _lamaroundservice.LamaRoundService,
        typeof _lamalogservice.LamaLogService === "undefined" ? Object : _lamalogservice.LamaLogService
    ])
], LamaPlayService);
