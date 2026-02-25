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
exports.NawakActionService = void 0;
const common_1 = require("@nestjs/common");
const player_name_helper_1 = require("../../../../modules/turn-policies/player-name.helper");
const game_core_service_1 = require("../../../../core/services/game-core.service");
const turn_flow_service_1 = require("../../../../modules/turn/services/turn-flow.service");
const nawak_challenge_service_1 = require("../data/nawak-challenge.service");
const action_service_helper_1 = require("../../../../actions/action-service.helper");
let NawakActionService = class NawakActionService {
    core;
    turns;
    challengeService;
    constructor(core, turns, challengeService) {
        this.core = core;
        this.turns = turns;
        this.challengeService = challengeService;
    }
    applyActions(state, actions) {
        return (0, action_service_helper_1.applyActionsSequentially)(state, actions, (next, action) => {
            const type = (0, action_service_helper_1.normalizeActionType)(action);
            return (0, action_service_helper_1.dispatchByActionType)(type, {
                choose_answer: () => this.handleChooseAnswer(next, action),
                vote_answer: () => this.handleVoteAnswer(next, action),
            }, () => next);
        });
    }
    handleChooseAnswer(state, action) {
        const currentId = state.turn?.currentPlayerId ?? null;
        if (currentId == null) {
            return state;
        }
        let meta = this.getMeta(state);
        if (meta.roundStage !== 'choose' || !meta.currentChallenge) {
            return state;
        }
        const payload = (action.payload ?? {});
        const answerIndex = typeof payload.answerIndex === 'number' ? payload.answerIndex : null;
        if (answerIndex == null || answerIndex < 0 || answerIndex >= 3) {
            return state;
        }
        const submissions = { ...(meta.submissions ?? {}) };
        if (submissions[currentId] != null) {
            return state;
        }
        submissions[currentId] = answerIndex;
        meta = { ...meta, submissions };
        let next = this.setMeta(state, meta);
        const answerLabel = meta.currentChallenge.answers?.[answerIndex] ?? 'réponse inconnue';
        next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerName)(state.players, currentId)} choisit "${answerLabel}".`);
        const playerIds = this.getPlayerIds(state.players);
        const allChosen = playerIds.every((pid) => submissions[pid] != null);
        if (allChosen) {
            meta = this.getMeta(next);
            const updatedMeta = {
                ...meta,
                roundStage: 'vote',
                votes: {},
            };
            next = this.setMeta(next, updatedMeta);
            next = this.core.appendLog(next, 'Tous les choix sont faits : votez maintenant pour une réponse étrangère !');
        }
        return this.turns.advanceTurn(next);
    }
    handleVoteAnswer(state, action) {
        const currentId = state.turn?.currentPlayerId ?? null;
        if (currentId == null) {
            return state;
        }
        let meta = this.getMeta(state);
        if (meta.roundStage !== 'vote') {
            return state;
        }
        const payload = (action.payload ?? {});
        const targetPlayerId = typeof payload.targetPlayerId === 'number'
            ? payload.targetPlayerId
            : null;
        if (targetPlayerId == null || targetPlayerId === currentId) {
            return state;
        }
        if (!this.getPlayerIds(state.players).includes(targetPlayerId)) {
            return state;
        }
        const submissions = meta.submissions ?? {};
        if (!Object.prototype.hasOwnProperty.call(submissions, targetPlayerId)) {
            return state;
        }
        const votes = { ...(meta.votes ?? {}) };
        if (votes[currentId] != null) {
            return state;
        }
        votes[currentId] = targetPlayerId;
        meta = { ...meta, votes };
        let next = this.setMeta(state, meta);
        next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerName)(state.players, currentId)} vote pour ${(0, player_name_helper_1.resolvePlayerName)(state.players, targetPlayerId)}.`);
        const playerIds = this.getPlayerIds(state.players);
        if (Object.keys(votes).length >= playerIds.length) {
            return this.finishVoting(next, playerIds, votes);
        }
        return this.turns.advanceTurn(next);
    }
    finishVoting(state, playerIds, votes) {
        const meta = this.getMeta(state);
        const challenge = meta.currentChallenge;
        const scores = { ...(meta.scores ?? {}) };
        const pointsAwarded = {};
        Object.values(votes).forEach((target) => {
            scores[target] = (scores[target] ?? 0) + 1;
            pointsAwarded[target] = (pointsAwarded[target] ?? 0) + 1;
        });
        const targetScore = meta.targetScore ?? 5;
        const qualified = playerIds.filter((pid) => (scores[pid] ?? 0) >= targetScore);
        const tie = qualified.length > 1;
        const winnerId = !tie && qualified.length === 1 ? qualified[0] : null;
        const summary = {
            challengeId: challenge?.id ?? 'unknown',
            prompt: challenge?.prompt ?? '',
            submissions: { ...(meta.submissions ?? {}) },
            votes: { ...votes },
            pointsAwarded,
            tie,
        };
        let nextMeta = {
            ...meta,
            scores,
            votes: {},
            submissions: {},
            roundStage: 'choose',
            lastRound: summary,
            winnerId,
        };
        const { challenge: nextChallenge, meta: withChallenge } = this.challengeService.loadChallenge(nextMeta);
        nextMeta = {
            ...withChallenge,
            targetScore,
            scores,
            roundStage: 'choose',
            submissions: {},
            votes: {},
            lastRound: summary,
            currentChallenge: nextChallenge,
            winnerId,
        };
        let next = this.setMeta(state, nextMeta);
        next = this.core.appendLog(next, 'Fin du vote : ouverture des scores !');
        const scoreboard = playerIds
            .map((pid) => `${(0, player_name_helper_1.resolvePlayerName)(state.players, pid)} ${scores[pid] ?? 0} pts`)
            .join(' / ');
        next = this.core.appendLog(next, `Scores : ${scoreboard}`);
        if (winnerId != null && !tie) {
            next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerName)(state.players, winnerId)} atteint ${scores[winnerId] ?? 0} points !`);
            return {
                ...next,
                status: 'finished',
            };
        }
        if (tie) {
            next = this.core.appendLog(next, 'égalité détectée : un nouveau défi va départager les joueurs.');
        }
        return this.turns.advanceTurn(next);
    }
    getMeta(state) {
        return (state.metadata ?? {});
    }
    setMeta(state, metadata) {
        return { ...state, metadata };
    }
    getPlayerIds(players) {
        return (Array.isArray(players) ? players : [])
            .filter((player) => typeof player?.id === 'number')
            .map((player) => player.id);
    }
};
exports.NawakActionService = NawakActionService;
exports.NawakActionService = NawakActionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [game_core_service_1.GameCoreService,
        turn_flow_service_1.TurnFlowService,
        nawak_challenge_service_1.NawakChallengeService])
], NawakActionService);
//# sourceMappingURL=nawak-action.service.js.map