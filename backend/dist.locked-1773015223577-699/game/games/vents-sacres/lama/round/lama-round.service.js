"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "LamaRoundService", {
    enumerable: true,
    get: function() {
        return LamaRoundService;
    }
});
const _common = require("@nestjs/common");
const _lamamodel = require("../model/lama.model");
const _randomservice = require("../../../../modules/random/services/random.service");
const _lamalogservice = require("../logging/lama-log.service");
const _lamasharedservice = require("../shared/lama-shared.service");
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
let LamaRoundService = class LamaRoundService {
    startNewRound(state, starterIndex) {
        const players = Array.isArray(state.players) ? state.players : [];
        const meta = {
            ...state.metadata ?? {}
        };
        const scores = meta.scoresByPlayerId ?? {};
        const loseAt = Number(meta.loseAtScore ?? 40);
        const eliminatedByPlayerId = this.buildEliminatedByScore(players, scores, loseAt, meta.eliminatedByPlayerId ?? {});
        const roundPlayers = players.filter((p)=>p?.id && !eliminatedByPlayerId[String(p.id)]);
        if (roundPlayers.length === 0) {
            return state;
        }
        const startingHandSize = this.resolveStartingHandSize(meta.startingHandSize);
        const copiesPerCardValue = this.resolveCopiesPerCardValue(meta.copiesPerCardValue);
        const baseDeck = this.buildDeck(copiesPerCardValue);
        const rngMeta = typeof meta.rng === 'object' && meta.rng ? {
            ...meta.rng
        } : {};
        const shuffled = this.random.shuffle(rngMeta, baseDeck);
        meta.rng = shuffled.meta;
        const deck = shuffled.values;
        const handsByPlayerId = {};
        const droppedOutByPlayerId = {};
        for (const p of players){
            if (!p?.id) continue;
            if (!eliminatedByPlayerId[String(p.id)]) {
                handsByPlayerId[String(p.id)] = [];
            }
            droppedOutByPlayerId[String(p.id)] = Boolean(eliminatedByPlayerId[String(p.id)]);
        }
        for(let i = 0; i < startingHandSize; i += 1){
            for (const p of roundPlayers){
                if (!p?.id) continue;
                const card = deck.pop();
                if (!card) continue;
                handsByPlayerId[String(p.id)].push(card);
            }
        }
        const firstDiscard = deck.pop() ?? 1;
        const discard = [
            firstDiscard
        ];
        const normalizedStarterIndex = this.findNextSurvivorStarterIndex(players, eliminatedByPlayerId, Math.max(-1, starterIndex - 1));
        const starterPlayerId = players[normalizedStarterIndex]?.id ?? roundPlayers[0]?.id ?? null;
        const starterName = starterPlayerId != null ? this.shared.playerLabel(players, starterPlayerId) : null;
        let log = this.logger.append(state.log, `Début de la manche ${meta.roundNumber}.`);
        if (starterName) {
            log = this.logger.append(log, `C'est au tour de ${starterName}.`);
        }
        log = this.logger.append(log, `Défausse: ${(0, _lamamodel.lamaCardLabel)(firstDiscard)}.`);
        const nextMeta = {
            ...meta,
            roundStarterIndex: normalizedStarterIndex,
            deck,
            discard,
            handsByPlayerId,
            droppedOutByPlayerId,
            eliminatedByPlayerId,
            step: 'turn_choice',
            turnTracker: {
                playerId: starterPlayerId,
                drawn: false,
                played: false
            },
            endedRoundNumber: null,
            pendingReturnQueue: [],
            pendingReturnPlayerId: null,
            winnerId: null,
            winnerPlayerId: null,
            suppressTurnAnnouncement: false
        };
        return (0, _pendingactionservice.createPendingState)({
            ...state,
            metadata: nextMeta,
            log,
            turn: {
                ...state.turn ?? {
                    direction: 1
                },
                currentPlayerId: starterPlayerId,
                direction: 1,
                label: starterPlayerId ? `Tour de ${this.shared.playerLabel(players, starterPlayerId)}` : undefined
            }
        }, {
            step: 'turn_choice',
            playerId: starterPlayerId
        });
    }
    endRound(state, winnerPlayerId) {
        const meta = {
            ...state.metadata ?? {}
        };
        const roundNumber = Number(meta.roundNumber ?? 1);
        if (Number(meta.endedRoundNumber ?? null) === roundNumber) {
            return state;
        }
        const players = Array.isArray(state.players) ? state.players : [];
        const handsByPlayerId = meta.handsByPlayerId ?? {};
        const scoresByPlayerId = {
            ...meta.scoresByPlayerId ?? {}
        };
        let log = Array.isArray(state.log) ? [
            ...state.log
        ] : [];
        const alreadyLoggedEnd = log.some((l)=>String(l?.message ?? '') === `Fin de la manche ${roundNumber}.`);
        if (alreadyLoggedEnd) {
            const winnerName = winnerPlayerId != null ? this.shared.playerLabel(players, winnerPlayerId) : null;
            const winnerScore = winnerPlayerId != null ? Number(scoresByPlayerId[String(winnerPlayerId)] ?? 0) : 0;
            const eligible = this.shouldPromptReturn(roundNumber, winnerScore, meta.returnTokenFromRound) && winnerPlayerId != null ? [
                winnerPlayerId
            ] : [];
            const nextMeta = {
                ...meta,
                scoresByPlayerId,
                endedRoundNumber: roundNumber,
                step: eligible.length ? 'return_token' : 'turn_choice',
                pendingReturnQueue: eligible,
                pendingReturnPlayerId: eligible.length ? eligible[0] : null,
                suppressTurnAnnouncement: false
            };
            const nextState = (0, _pendingactionservice.createPendingState)({
                ...state,
                metadata: nextMeta,
                turn: {
                    ...state.turn ?? {
                        direction: 1
                    },
                    currentPlayerId: eligible.length ? eligible[0] : state.turn?.currentPlayerId ?? null,
                    direction: 1,
                    label: eligible.length ? `Rendre des jetons : ${this.shared.playerLabel(players, eligible[0])}` : winnerName ? `Fin de manche : ${winnerName}` : state.turn?.label
                }
            }, {
                step: nextMeta.step,
                playerId: nextMeta.pendingReturnPlayerId ?? null
            });
            if (eligible.length) {
                return nextState;
            }
            return this.finishRoundAndMaybeStartNext(nextState);
        }
        log = this.logger.append(log, `Fin de la manche ${roundNumber}.`);
        for (const p of players){
            if (!p?.id) continue;
            const pid = p.id;
            const hand = handsByPlayerId[String(pid)] ?? [];
            const unique = [
                ...new Set(hand)
            ];
            const gained = unique.reduce((sum, v)=>sum + (0, _lamamodel.lamaCardScore)(v), 0);
            scoresByPlayerId[String(pid)] = Number(scoresByPlayerId[String(pid)] ?? 0) + gained;
            if (gained > 0) {
                log = this.logger.append(log, `${this.shared.playerLabel(players, pid)} prend ${gained} jeton${gained > 1 ? 's' : ''} (pénalité).`);
            }
        }
        const winnerName = winnerPlayerId != null ? this.shared.playerLabel(players, winnerPlayerId) : null;
        if (winnerName) {
            log = this.logger.append(log, `${winnerName} gagne la manche.`);
        }
        const winnerScore = winnerPlayerId != null ? Number(scoresByPlayerId[String(winnerPlayerId)] ?? 0) : 0;
        const eligible = this.shouldPromptReturn(roundNumber, winnerScore, meta.returnTokenFromRound) && winnerPlayerId != null ? [
            winnerPlayerId
        ] : [];
        if (winnerName && eligible.length === 0) {
            log = this.logger.append(log, `${winnerName} n'a rien à rendre.`);
        }
        const nextMeta = {
            ...meta,
            scoresByPlayerId,
            endedRoundNumber: roundNumber,
            step: eligible.length ? 'return_token' : 'turn_choice',
            pendingReturnQueue: eligible,
            pendingReturnPlayerId: eligible.length ? eligible[0] : null,
            suppressTurnAnnouncement: false
        };
        const nextState = (0, _pendingactionservice.createPendingState)({
            ...state,
            metadata: nextMeta,
            log,
            turn: {
                ...state.turn ?? {
                    direction: 1
                },
                currentPlayerId: eligible.length ? eligible[0] : state.turn?.currentPlayerId ?? null,
                direction: 1,
                label: eligible.length ? `Rendre des jetons : ${this.shared.playerLabel(players, eligible[0])}` : undefined
            }
        }, {
            step: nextMeta.step,
            playerId: nextMeta.pendingReturnPlayerId ?? null
        });
        if (eligible.length) {
            return nextState;
        }
        return this.finishRoundAndMaybeStartNext(nextState);
    }
    finishRoundAndMaybeStartNext(state) {
        const meta = {
            ...state.metadata ?? {}
        };
        const players = Array.isArray(state.players) ? state.players : [];
        const scores = meta.scoresByPlayerId ?? {};
        const loseAt = Number(meta.loseAtScore ?? 40);
        const previousEliminated = meta.eliminatedByPlayerId ?? {};
        const eliminatedByPlayerId = this.buildEliminatedByScore(players, scores, loseAt, previousEliminated);
        const newlyEliminated = players.filter((p)=>p?.id && !previousEliminated[String(p.id)] && eliminatedByPlayerId[String(p.id)]);
        const survivors = players.filter((p)=>p?.id && !eliminatedByPlayerId[String(p.id)]);
        let log = state.log;
        for (const p of newlyEliminated){
            const pid = p.id;
            const score = Number(scores[String(pid)] ?? 0);
            log = this.logger.append(log, `${this.shared.playerLabel(players, pid)} est éliminé${p?.isBot ? '' : '(e)'} (${score} jetons).`);
        }
        if (survivors.length <= 1) {
            let winnerId = null;
            if (survivors.length === 1) {
                winnerId = survivors[0]?.id ?? null;
            } else {
                let best = Number.POSITIVE_INFINITY;
                for (const p of players){
                    const pid = p?.id;
                    if (!pid) continue;
                    const s = Number(scores[String(pid)] ?? 0);
                    if (s < best) {
                        best = s;
                        winnerId = pid;
                    }
                }
            }
            log = this.logger.append(log, `Partie terminée.`);
            if (winnerId) {
                log = this.logger.append(log, `Gagnant : ${this.shared.playerLabel(players, winnerId)}.`);
            }
            return {
                ...state,
                status: 'finished',
                log,
                metadata: {
                    ...meta,
                    eliminatedByPlayerId,
                    winnerId,
                    winnerPlayerId: winnerId
                }
            };
        }
        const nextRound = Number(meta.roundNumber ?? 1) + 1;
        const starter = this.findNextSurvivorStarterIndex(players, eliminatedByPlayerId, Number(meta.roundStarterIndex ?? 0));
        const pauseSeconds = Number(meta.roundPauseSeconds ?? 0);
        const pauseMs = Number.isFinite(pauseSeconds) ? Math.max(0, Math.floor(pauseSeconds) * 1000) : 0;
        const updatedMeta = {
            ...meta,
            roundNumber: nextRound,
            roundStarterIndex: starter,
            endedRoundNumber: null,
            step: pauseMs > 0 ? 'round_pause' : 'turn_choice',
            roundPauseUntilMs: pauseMs > 0 ? Date.now() + pauseMs : null,
            pendingReturnQueue: [],
            pendingReturnPlayerId: null,
            eliminatedByPlayerId,
            winnerId: null,
            winnerPlayerId: null,
            suppressTurnAnnouncement: false
        };
        if (pauseMs > 0) {
            const pauseLog = this.logger.append(log, `Pause ${Math.floor(pauseMs / 1000)}s avant la manche ${nextRound}.`);
            return (0, _pendingactionservice.createPendingState)({
                ...state,
                phase: 'round',
                round: nextRound,
                log: pauseLog,
                metadata: updatedMeta,
                turn: {
                    ...state.turn ?? {
                        direction: 1
                    },
                    currentPlayerId: meta.ownerPlayerId ?? state.turn?.currentPlayerId ?? null,
                    direction: 1,
                    label: `Pause avant la manche ${nextRound}`
                }
            }, {
                step: 'round_pause',
                playerId: meta.ownerPlayerId ?? null
            });
        }
        return this.startNewRound({
            ...state,
            metadata: updatedMeta,
            round: nextRound,
            log
        }, starter);
    }
    isRoundEnded(meta, _players) {
        const hands = meta.handsByPlayerId ?? {};
        const dropped = meta.droppedOutByPlayerId ?? {};
        const ids = Object.keys(hands);
        if (ids.length === 0) return true;
        const someoneEmpty = ids.some((id)=>(hands[id] ?? []).length === 0);
        if (someoneEmpty) return true;
        const active = ids.filter((id)=>!dropped[id]);
        // Continue the round while the last active player can still act.
        // End only when everyone has dropped out (or someone emptied their hand above).
        if (active.length === 0) return true;
        return false;
    }
    findNextActivePlayerId(players, meta, afterPlayerId) {
        const ids = players.map((p)=>p?.id).filter((id)=>typeof id === 'number');
        if (!ids.length) return null;
        const start = Math.max(0, ids.indexOf(afterPlayerId));
        const dropped = meta.droppedOutByPlayerId ?? {};
        for(let step = 1; step <= ids.length; step += 1){
            const pid = ids[(start + step) % ids.length];
            if (!dropped[String(pid)]) return pid;
        }
        return ids[start] ?? null;
    }
    findRoundWinnerId(meta, players) {
        const empty = this.findEmptyHandWinnerId(meta, players);
        if (empty != null) return empty;
        const hands = meta.handsByPlayerId ?? {};
        const dropped = meta.droppedOutByPlayerId ?? {};
        const ids = Object.keys(hands);
        const active = ids.filter((id)=>!dropped[id]);
        if (active.length === 1) return Number(active[0]);
        return null;
    }
    buildDeck(copiesPerCardValue) {
        const deck = [];
        for (const v of [
            1,
            2,
            3,
            4,
            5,
            6,
            _lamamodel.LAMA_VALUE
        ]){
            for(let i = 0; i < copiesPerCardValue; i += 1)deck.push(v);
        }
        return deck;
    }
    findEmptyHandWinnerId(meta, players) {
        const hands = meta.handsByPlayerId ?? {};
        const ids = players.map((p)=>p?.id).filter((id)=>typeof id === 'number');
        for (const pid of ids){
            const hand = hands[String(pid)] ?? [];
            if (hand.length === 0) return pid;
        }
        return null;
    }
    shouldPromptReturn(roundNumber, winnerScore, returnTokenFromRound) {
        if (winnerScore < 1) return false;
        return roundNumber >= this.resolveReturnTokenFromRound(returnTokenFromRound);
    }
    resolveStartingHandSize(value) {
        const parsed = Number(value ?? 6);
        if (!Number.isFinite(parsed)) return 6;
        const rounded = Math.floor(parsed);
        if (rounded < 1 || rounded > 20) return 6;
        return rounded;
    }
    resolveCopiesPerCardValue(value) {
        const parsed = Number(value ?? 8);
        if (!Number.isFinite(parsed)) return 8;
        const rounded = Math.floor(parsed);
        if (rounded < 1 || rounded > 20) return 8;
        return rounded;
    }
    resolveReturnTokenFromRound(value) {
        const parsed = Number(value ?? 2);
        if (!Number.isFinite(parsed)) return 2;
        const rounded = Math.floor(parsed);
        if (rounded < 1 || rounded > 50) return 2;
        return rounded;
    }
    buildEliminatedByScore(players, scoresByPlayerId, loseAtScore, previous) {
        const out = {
            ...previous ?? {}
        };
        for (const p of players){
            const pid = p?.id;
            if (!pid) continue;
            const score = Number(scoresByPlayerId[String(pid)] ?? 0);
            out[String(pid)] = score >= loseAtScore;
        }
        return out;
    }
    findNextSurvivorStarterIndex(players, eliminatedByPlayerId, afterIndex) {
        if (!Array.isArray(players) || players.length === 0) {
            return 0;
        }
        const length = players.length;
        const start = Number.isFinite(afterIndex) ? afterIndex : -1;
        for(let step = 1; step <= length; step += 1){
            const idx = ((start + step) % length + length) % length;
            const pid = players[idx]?.id;
            if (!pid) continue;
            if (!eliminatedByPlayerId[String(pid)]) {
                return idx;
            }
        }
        return 0;
    }
    constructor(random, logger, shared){
        this.random = random;
        this.logger = logger;
        this.shared = shared;
    }
};
LamaRoundService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _randomservice.RandomService === "undefined" ? Object : _randomservice.RandomService,
        typeof _lamalogservice.LamaLogService === "undefined" ? Object : _lamalogservice.LamaLogService,
        typeof _lamasharedservice.LamaSharedService === "undefined" ? Object : _lamasharedservice.LamaSharedService
    ])
], LamaRoundService);
