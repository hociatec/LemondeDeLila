"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "LamaDrawService", {
    enumerable: true,
    get: function() {
        return LamaDrawService;
    }
});
const _common = require("@nestjs/common");
const _lamamodel = require("../model/lama.model");
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
let LamaDrawService = class LamaDrawService {
    applyDraw(state, meta, actorId) {
        const dropped = meta.droppedOutByPlayerId ?? {};
        const drawLocked = Object.values(dropped).some((isOut)=>Boolean(isOut));
        if (drawLocked) {
            return state;
        }
        const tracker = meta.turnTracker ?? {
            playerId: actorId,
            drawn: false,
            played: false
        };
        if (this.shared.asNumberOrNull(tracker.playerId) === actorId && this.shared.asBoolean(tracker.drawn)) {
            return state;
        }
        const turnIndex = Number(state.turnIndex ?? 0);
        const lastDrawMap = meta?.lastDrawTurnIndexByPlayerId ?? null;
        const lastDrawIndex = lastDrawMap && typeof lastDrawMap === 'object' ? this.shared.asNumberOrNull(lastDrawMap[String(actorId)]) : null;
        if (lastDrawIndex != null && lastDrawIndex === turnIndex) {
            return state;
        }
        const deck = Array.isArray(meta.deck) ? [
            ...meta.deck
        ] : [];
        if (deck.length <= 0) return state;
        const card = deck.pop();
        const handsByPlayerId = {
            ...meta.handsByPlayerId ?? {}
        };
        const hand = [
            ...handsByPlayerId[String(actorId)] ?? []
        ];
        hand.push(card);
        handsByPlayerId[String(actorId)] = hand;
        const players = Array.isArray(state.players) ? state.players : [];
        const name = this.shared.playerLabel(players, actorId);
        const label = (0, _lamamodel.lamaCardLabel)(card);
        const log = this.logger.append(state.log, `${name} pioche un ${label}.`);
        const nextMeta = {
            ...meta,
            deck,
            handsByPlayerId,
            lastDrawTurnIndexByPlayerId: {
                ...meta.lastDrawTurnIndexByPlayerId ?? {},
                [String(actorId)]: turnIndex + 1
            },
            turnTracker: {
                playerId: actorId,
                drawn: true,
                played: false
            },
            suppressTurnAnnouncement: false
        };
        const nextPlayerId = this.round.findNextActivePlayerId(players, nextMeta, actorId);
        const advancedMeta = {
            ...nextMeta,
            turnTracker: {
                playerId: nextPlayerId,
                drawn: false,
                played: false
            },
            suppressTurnAnnouncement: false
        };
        const nextState = (0, _pendingactionservice.createPendingState)({
            ...state,
            metadata: advancedMeta,
            log,
            turnIndex: turnIndex + 1,
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
        if (this.round.isRoundEnded(advancedMeta, players)) {
            const winnerId = this.round.findRoundWinnerId(advancedMeta, players);
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
LamaDrawService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _lamasharedservice.LamaSharedService === "undefined" ? Object : _lamasharedservice.LamaSharedService,
        typeof _lamaroundservice.LamaRoundService === "undefined" ? Object : _lamaroundservice.LamaRoundService,
        typeof _lamalogservice.LamaLogService === "undefined" ? Object : _lamalogservice.LamaLogService
    ])
], LamaDrawService);
