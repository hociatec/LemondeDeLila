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
            startingHandSize: null,
            copiesPerCardValue: null,
            allowDrawAfterFirstQuit: false,
            returnTokenFromRound: null,
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
                return Number.NaN;
            }
        })();
        if (Number.isNaN(roundPauseSeconds)) return state;
        if (!Number.isFinite(roundPauseSeconds) || roundPauseSeconds == null || roundPauseSeconds < 0 || roundPauseSeconds > 120) {
            return state;
        }
        const startingHandSizeRaw = (()=>{
            try {
                return (0, _payloadvalidatorshelper.optionalInt)(action.payload ?? {}, 'startingHandSize');
            } catch  {
                return Number.NaN;
            }
        })();
        if (Number.isNaN(startingHandSizeRaw)) return state;
        const startingHandSize = Number(startingHandSizeRaw ?? meta.startingHandSize ?? 6);
        if (!Number.isFinite(startingHandSize) || startingHandSize < 1 || startingHandSize > 20) {
            return state;
        }
        const copiesPerCardValueRaw = (()=>{
            try {
                return (0, _payloadvalidatorshelper.optionalInt)(action.payload ?? {}, 'copiesPerCardValue');
            } catch  {
                return Number.NaN;
            }
        })();
        if (Number.isNaN(copiesPerCardValueRaw)) return state;
        const copiesPerCardValue = Number(copiesPerCardValueRaw ?? meta.copiesPerCardValue ?? 8);
        if (!Number.isFinite(copiesPerCardValue) || copiesPerCardValue < 1 || copiesPerCardValue > 20) {
            return state;
        }
        const returnTokenFromRoundRaw = (()=>{
            try {
                return (0, _payloadvalidatorshelper.optionalInt)(action.payload ?? {}, 'returnTokenFromRound');
            } catch  {
                return Number.NaN;
            }
        })();
        if (Number.isNaN(returnTokenFromRoundRaw)) return state;
        const returnTokenFromRound = Number(returnTokenFromRoundRaw ?? meta.returnTokenFromRound ?? 2);
        if (!Number.isFinite(returnTokenFromRound) || returnTokenFromRound < 1 || returnTokenFromRound > 50) {
            return state;
        }
        const players = Array.isArray(state.players) ? state.players : [];
        const activePlayers = players.filter((p)=>p?.id).length;
        const deckSize = 7 * copiesPerCardValue;
        if (activePlayers * startingHandSize + 1 > deckSize) {
            const maxHandSize = activePlayers > 0 ? Math.floor((deckSize - 1) / activePlayers) : 0;
            const name = this.shared.playerLabel(players, actorId);
            const nextLog = this.logger.append(state.log, `${name} propose une configuration invalide: ${startingHandSize} cartes de départ avec ${activePlayers} joueurs et ${copiesPerCardValue} exemplaires par carte. Maximum autorisé: ${Math.max(maxHandSize, 1)} cartes.`);
            return {
                ...state,
                log: nextLog
            };
        }
        const updatedMeta = {
            ...meta,
            loseAtScore,
            roundPauseSeconds,
            allowPlayAfterDraw: this.readAllowPlayAfterDraw(action.payload ?? {}),
            startingHandSize,
            copiesPerCardValue,
            allowDrawAfterFirstQuit: this.readAllowDrawAfterFirstQuit(action.payload ?? {}, meta.allowDrawAfterFirstQuit ?? false),
            returnTokenFromRound,
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
        const name = this.shared.playerLabel(players, actorId);
        log = this.logger.append(log, `${name} fixe la défaite à ${loseAtScore} jetons.`);
        log = this.logger.append(log, `${name} règle la pause entre manches à ${roundPauseSeconds}s.`);
        log = this.logger.append(log, `${name} ${updatedMeta.allowPlayAfterDraw ? 'autorise' : 'interdit'} de rejouer après une pioche.`);
        log = this.logger.append(log, `${name} distribue ${startingHandSize} cartes par manche.`);
        log = this.logger.append(log, `${name} règle le paquet à ${copiesPerCardValue} exemplaires par valeur.`);
        log = this.logger.append(log, `${name} ${updatedMeta.allowDrawAfterFirstQuit ? 'autorise' : 'interdit'} la pioche après le premier retrait.`);
        log = this.logger.append(log, `${name} autorise le rendu de jetons à partir de la manche ${returnTokenFromRound}.`);
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
    readAllowPlayAfterDraw(payload) {
        const raw = payload?.allowPlayAfterDraw;
        if (typeof raw === 'boolean') return raw;
        if (typeof raw === 'number') return raw === 1;
        if (typeof raw !== 'string') return false;
        const value = raw.trim().toLowerCase();
        if (value === 'true' || value === '1' || value === 'yes' || value === 'oui' || value === 'on') {
            return true;
        }
        if (value === 'false' || value === '0' || value === 'no' || value === 'non' || value === 'off') {
            return false;
        }
        return false;
    }
    readAllowDrawAfterFirstQuit(payload, fallback) {
        const raw = payload?.allowDrawAfterFirstQuit;
        if (raw == null || raw === '') return fallback;
        if (typeof raw === 'boolean') return raw;
        if (typeof raw === 'number') return raw === 1;
        if (typeof raw !== 'string') return fallback;
        const value = raw.trim().toLowerCase();
        if (value === 'true' || value === '1' || value === 'yes' || value === 'oui' || value === 'on') {
            return true;
        }
        if (value === 'false' || value === '0' || value === 'no' || value === 'non' || value === 'off') {
            return false;
        }
        return fallback;
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
