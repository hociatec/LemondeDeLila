"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "LamaSetupService", {
    enumerable: true,
    get: function() {
        return LamaSetupService;
    }
});
const _common = require("@nestjs/common");
const _setupservicehelper = require("../../../../setup/setup-service.helper");
const _pendingactionservice = require("../../../../modules/pending-action/services/pending-action.service");
const _payloadvalidatorshelper = require("../../../../core/helpers/payload-validators.helper");
const _lamaroundservice = require("../round/lama-round.service");
const _lamasharedservice = require("../shared/lama-shared.service");
const _lamalogservice = require("../logging/lama-log.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let LamaSetupService = class LamaSetupService {
    hydrateInitialState(baseState) {
        const status = String(baseState.status ?? '').toLowerCase().trim();
        const currentStep = String((baseState.metadata ?? {})?.step ?? '').trim();
        if (status === 'started' && currentStep && currentStep !== 'setup_config') {
            return baseState;
        }
        if (status !== 'started') {
            return {
                ...baseState,
                metadata: {
                    ...baseState.metadata ?? {}
                }
            };
        }
        const players = (0, _setupservicehelper.getSafePlayers)(baseState);
        const metaAny = baseState.metadata ?? {};
        const pickFirstHumanId = ()=>{
            const p = players.find((pl)=>pl?.id && pl.isBot !== true);
            return typeof p?.id === 'number' ? p.id : null;
        };
        const pickOwnerId = ()=>{
            const metaOwner = typeof metaAny.ownerPlayerId === 'number' ? metaAny.ownerPlayerId : null;
            if (metaOwner != null && players.some((p)=>p?.id === metaOwner)) {
                return metaOwner;
            }
            const roomOwner = typeof metaAny.roomOwnerId === 'number' ? metaAny.roomOwnerId : null;
            if (roomOwner != null && players.some((p)=>p?.id === roomOwner)) {
                return roomOwner;
            }
            return pickFirstHumanId() ?? players[0]?.id ?? null;
        };
        let ownerPlayerId = pickOwnerId();
        if (typeof ownerPlayerId === 'number') {
            const owner = players.find((p)=>p?.id === ownerPlayerId) ?? null;
            if (owner?.isBot === true) {
                ownerPlayerId = pickFirstHumanId() ?? ownerPlayerId;
            }
        }
        const scoresByPlayerId = {};
        for (const p of players){
            if (!p?.id) continue;
            scoresByPlayerId[String(p.id)] = 0;
        }
        const meta = {
            rng: typeof baseState.metadata === 'object' && baseState.metadata ? baseState.metadata.rng : undefined,
            ownerPlayerId,
            loseAtScore: null,
            roundPauseSeconds: null,
            allowPlayAfterDraw: false,
            roundPauseUntilMs: null,
            roundNumber: 1,
            roundStarterIndex: 0,
            endedRoundNumber: null,
            deck: [],
            discard: [],
            handsByPlayerId: {},
            droppedOutByPlayerId: {},
            scoresByPlayerId,
            eliminatedByPlayerId: {},
            step: 'setup_config',
            turnTracker: {
                playerId: ownerPlayerId,
                drawn: false,
                played: false
            },
            pendingReturnQueue: [],
            pendingReturnPlayerId: null,
            winnerId: null,
            suppressTurnAnnouncement: true
        };
        return (0, _pendingactionservice.createPendingState)({
            ...baseState,
            status: 'started',
            phase: 'setup',
            round: baseState.round ?? 0,
            turnIndex: baseState.turnIndex ?? 0,
            lastRoll: null,
            log: Array.isArray(baseState.log) ? baseState.log : [],
            metadata: meta,
            turn: {
                ...baseState.turn ?? {
                    direction: 1
                },
                currentPlayerId: ownerPlayerId,
                direction: 1,
                label: ownerPlayerId ? `Réglages LAMA : ${this.shared.playerLabel(players, ownerPlayerId)}` : 'Réglages LAMA'
            }
        }, {
            step: 'setup_config',
            playerId: ownerPlayerId,
            blocking: true
        });
    }
    applySetupConfig(state, meta, action, actorId) {
        if (meta.ownerPlayerId == null || actorId !== meta.ownerPlayerId) return state;
        const loseAtScore = (()=>{
            try {
                return (0, _payloadvalidatorshelper.optionalInt)(action.payload ?? {}, 'loseAtScore');
            } catch  {
                return undefined;
            }
        })();
        if (!Number.isFinite(loseAtScore) || loseAtScore == null || loseAtScore < 5 || loseAtScore > 200) {
            return state;
        }
        const roundPauseSeconds = (()=>{
            try {
                return (0, _payloadvalidatorshelper.optionalInt)(action.payload ?? {}, 'roundPauseSeconds');
            } catch  {
                return undefined;
            }
        })();
        if (!Number.isFinite(roundPauseSeconds) || roundPauseSeconds == null || roundPauseSeconds < 0 || roundPauseSeconds > 120) {
            return state;
        }
        const updatedMeta = {
            ...meta,
            loseAtScore,
            roundPauseSeconds,
            allowPlayAfterDraw: false,
            roundPauseUntilMs: null,
            step: 'turn_choice',
            roundNumber: 1,
            roundStarterIndex: 0,
            turnTracker: {
                playerId: null,
                drawn: false,
                played: false
            },
            pendingReturnQueue: [],
            pendingReturnPlayerId: null,
            eliminatedByPlayerId: {},
            suppressTurnAnnouncement: true
        };
        let log = state.log;
        const players = Array.isArray(state.players) ? state.players : [];
        const name = this.shared.playerLabel(players, actorId);
        log = this.logger.append(log, `${name} fixe la défaite à ${loseAtScore} jetons.`);
        log = this.logger.append(log, `${name} règle la pause entre manches à ${roundPauseSeconds}s.`);
        log = this.logger.append(log, `Début de la partie.`);
        return this.round.startNewRound({
            ...state,
            status: 'started',
            phase: 'round',
            round: 1,
            turnIndex: state.turnIndex ?? 0,
            lastRoll: null,
            pending: null,
            log,
            metadata: updatedMeta
        }, updatedMeta.roundStarterIndex);
    }
    resumeRoundPause(state, meta) {
        const until = typeof meta.roundPauseUntilMs === 'number' ? meta.roundPauseUntilMs : null;
        if (until != null && Date.now() < until) {
            return state;
        }
        const clearedMeta = {
            ...meta,
            roundPauseUntilMs: null,
            step: 'turn_choice',
            suppressTurnAnnouncement: false
        };
        return this.round.startNewRound({
            ...state,
            turnIndex: (state.turnIndex ?? 0) + 1,
            metadata: clearedMeta,
            phase: 'round',
            round: Number(clearedMeta.roundNumber ?? state.round ?? 1)
        }, Number(clearedMeta.roundStarterIndex ?? 0));
    }
    constructor(shared, round, logger){
        this.shared = shared;
        this.round = round;
        this.logger = logger;
    }
};
LamaSetupService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _lamasharedservice.LamaSharedService === "undefined" ? Object : _lamasharedservice.LamaSharedService,
        typeof _lamaroundservice.LamaRoundService === "undefined" ? Object : _lamaroundservice.LamaRoundService,
        typeof _lamalogservice.LamaLogService === "undefined" ? Object : _lamalogservice.LamaLogService
    ])
], LamaSetupService);
