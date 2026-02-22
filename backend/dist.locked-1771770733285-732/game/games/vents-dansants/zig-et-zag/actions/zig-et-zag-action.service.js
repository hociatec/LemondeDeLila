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
exports.ZigEtZagActionService = void 0;
const common_1 = require("@nestjs/common");
const player_name_helper_1 = require("../../../../modules/turn-policies/player-name.helper");
const game_core_service_1 = require("../../../../core/services/game-core.service");
const turn_flow_service_1 = require("../../../../modules/turn/services/turn-flow.service");
const random_service_1 = require("../../../../modules/random/services/random.service");
const action_service_helper_1 = require("../../../../actions/action-service.helper");
const zig_et_zag_cards_1 = require("../model/zig-et-zag-cards");
const round_state_helper_1 = require("../round-state.helper");
let ZigEtZagActionService = class ZigEtZagActionService {
    core;
    turns;
    random;
    constructor(core, turns, random) {
        this.core = core;
        this.turns = turns;
        this.random = random;
    }
    applyActions(state, actions) {
        return (0, action_service_helper_1.applyActionsSequentially)(state, actions, (next, action) => {
            const type = (0, action_service_helper_1.normalizeLowerActionType)(action);
            return (0, action_service_helper_1.dispatchByActionType)(type, {
                select_card: () => this.handleSelectCard(next, action),
                draw_card: () => this.handleDrawCard(next, action),
            }, () => next);
        });
    }
    handleSelectCard(state, action) {
        const actorId = this.getActorId(action, state);
        if (actorId == null) {
            return state;
        }
        const cardId = String(action.payload?.cardId ?? '').trim();
        if (!cardId) {
            return state;
        }
        if (String(state.status ?? '').toLowerCase() !== 'started') {
            return state;
        }
        const players = Array.isArray(state.players) ? state.players : [];
        if (!players.length) {
            return state;
        }
        const ensured = this.ensureRoundState(state, players);
        state = ensured.state;
        const meta = this.getMeta(state);
        const round = ensured.round;
        if (!round || !this.isWaitingPlayer(round, actorId)) {
            return state;
        }
        if (!(0, round_state_helper_1.playerHasCard)(meta, actorId, cardId)) {
            return state;
        }
        if (!(0, round_state_helper_1.isCardAllowed)(round, actorId, cardId)) {
            return state;
        }
        return this.playCardWithId(state, players, meta, round, actorId, cardId);
    }
    handleDrawCard(state, action) {
        const actorId = this.getActorId(action, state);
        if (actorId == null) {
            return state;
        }
        if (String(state.status ?? '').toLowerCase() !== 'started') {
            return state;
        }
        const players = Array.isArray(state.players) ? state.players : [];
        if (!players.length) {
            return state;
        }
        const ensured = this.ensureRoundState(state, players);
        state = ensured.state;
        const meta = this.getMeta(state);
        const round = ensured.round;
        if (!round || !this.isWaitingPlayer(round, actorId)) {
            return state;
        }
        const hand = (0, round_state_helper_1.getPlayerHand)(meta, actorId);
        if (!hand.length) {
            return state;
        }
        const rngMeta = meta.rng ?? {};
        const { index, meta: nextRng } = this.random.pickIndex(rngMeta, hand.length);
        const cardId = hand[index];
        if (!cardId) {
            return state;
        }
        const metaWithRng = { ...meta, rng: nextRng };
        const withDrawLog = this.core.appendLog(state, `${(0, player_name_helper_1.resolvePlayerName)(players, actorId)} pioche.`);
        return this.playCardWithId(withDrawLog, players, metaWithRng, round, actorId, cardId);
    }
    finalizeStage(state, players) {
        const meta = this.getMeta(state);
        const round = meta.roundState;
        if (!round) {
            return state;
        }
        switch (round.stage) {
            case 'selection':
                return this.handleSelectionCompletion(state, players, round);
            case 'battle_face_down':
                return this.promoteToBattleFaceUp(state, players, round);
            case 'battle_face_up':
                return this.resolveBattle(state, players, round);
            default:
                return state;
        }
    }
    handleSelectionCompletion(state, players, round) {
        const meta = this.getMeta(state);
        let nextState = this.appendCollectiveRevealLog(state, players, round);
        nextState = this.appendRevealLogs(nextState, players, round);
        if (this.hasSelectionJoker(round)) {
            nextState = this.core.appendLog(nextState, 'Joker joué hors bataille : les cartes sont défaussées.');
            return this.finishRound(nextState, players, round, null);
        }
        const evaluation = this.evaluateFaceUpPlays(round);
        if (evaluation.tiePlayers.length > 1) {
            const nextRound = this.prepareBattle(round, evaluation.tiePlayers, meta);
            nextState = this.core.appendLog(nextState, 'Bataille déclenchée !');
            if (!nextRound.waitingPlayers.length) {
                return this.finishRound(nextState, players, nextRound, nextRound.tiedPlayers[0] ?? null);
            }
            nextState = this.setRoundState(nextState, meta, nextRound);
            return this.setCurrentPlayerWithAnnouncement(nextState, players, this.pickNextCurrentPlayerId(nextRound, nextState.turn?.currentPlayerId ?? 0), true);
        }
        return this.finishRound(nextState, players, round, evaluation.winnerId);
    }
    prepareBattle(round, tiedPlayers, metadata) {
        const plays = round.plays.map((play) => ({ ...play }));
        const waitingPlayers = [];
        const triggerColors = { ...round.triggerColors };
        const triggerFamilies = { ...round.triggerFamilies };
        tiedPlayers.forEach((playerId) => {
            const entry = plays.find((play) => play.playerId === playerId);
            if (entry?.faceUpCard) {
                const def = zig_et_zag_cards_1.ZIG_ET_ZAG_CARD_BY_ID[entry.faceUpCard];
                if (def) {
                    triggerColors[playerId] = def.color;
                    triggerFamilies[playerId] = def.family;
                }
            }
            if ((0, round_state_helper_1.getPlayerHandSize)(metadata, playerId) > 0) {
                waitingPlayers.push(playerId);
            }
            else if (entry) {
                entry.lostByNoCard = true;
            }
        });
        return {
            ...round,
            stage: 'battle_face_down',
            plays,
            waitingPlayers,
            tiedPlayers: waitingPlayers,
            triggerColors,
            triggerFamilies,
            battleLog: [...round.battleLog, 'Bataille déclenchée !'],
        };
    }
    promoteToBattleFaceUp(state, players, round) {
        const meta = this.getMeta(state);
        const plays = round.plays.map((play) => ({ ...play }));
        const battleLog = [...round.battleLog];
        const waitingPlayers = [];
        let nextState = state;
        round.tiedPlayers.forEach((playerId) => {
            if ((0, round_state_helper_1.getPlayerHandSize)(meta, playerId) <= 0) {
                const entry = plays.find((play) => play.playerId === playerId);
                if (entry) {
                    entry.lostByNoCard = true;
                }
                const message = `${(0, player_name_helper_1.resolvePlayerName)(players, playerId)} n'a plus de cartes.`;
                battleLog.push(message);
                nextState = this.core.appendLog(nextState, message);
                return;
            }
            waitingPlayers.push(playerId);
        });
        if (!waitingPlayers.length) {
            return this.finishRound(nextState, players, { ...round, plays }, null);
        }
        if (waitingPlayers.length === 1) {
            return this.finishRound(nextState, players, { ...round, plays }, waitingPlayers[0]);
        }
        const nextRound = {
            ...round,
            stage: 'battle_face_up',
            plays,
            waitingPlayers,
            tiedPlayers: waitingPlayers,
            battleLog,
        };
        nextState = this.setRoundState(nextState, meta, nextRound);
        return this.setCurrentPlayerWithAnnouncement(nextState, players, this.pickNextCurrentPlayerId(nextRound, nextState.turn?.currentPlayerId ?? 0), true);
    }
    resolveBattle(state, players, round) {
        let nextState = this.appendCollectiveRevealLog(state, players, round, round.tiedPlayers);
        nextState = this.appendRevealLogs(nextState, players, round, round.tiedPlayers);
        const meta = this.getMeta(state);
        const faceUpPlays = round.plays.filter((play) => round.tiedPlayers.includes(play.playerId) &&
            !play.lostByNoCard &&
            play.faceUpCard &&
            !play.invalidJoker);
        const results = faceUpPlays
            .map((play) => {
            const def = zig_et_zag_cards_1.ZIG_ET_ZAG_CARD_BY_ID[play.faceUpCard];
            return def
                ? {
                    playerId: play.playerId,
                    value: def.value,
                    color: def.color,
                    family: def.family,
                }
                : { playerId: play.playerId, value: -1 };
        })
            .filter((entry) => entry.value >= 0);
        if (!results.length) {
            nextState = this.core.appendLog(nextState, 'Aucune carte valide : les cartes sont défaussées.');
            return this.finishRound(nextState, players, round, null);
        }
        const maxValue = Math.max(...results.map((entry) => entry.value));
        const winners = results
            .filter((entry) => entry.value === maxValue)
            .map((entry) => entry.playerId);
        if (winners.length === 1) {
            return this.finishRound(nextState, players, round, winners[0]);
        }
        const triggerColors = { ...round.triggerColors };
        const triggerFamilies = { ...round.triggerFamilies };
        results.forEach((entry) => {
            if (entry.color) {
                triggerColors[entry.playerId] = entry.color;
                triggerFamilies[entry.playerId] = entry.family;
            }
        });
        const waitingPlayers = winners.filter((playerId) => (0, round_state_helper_1.getPlayerHandSize)(meta, playerId) > 0);
        if (!waitingPlayers.length) {
            return this.finishRound(nextState, players, round, winners[0] ?? null);
        }
        const nextRound = {
            ...round,
            stage: 'battle_face_down',
            tiedPlayers: winners,
            waitingPlayers,
            triggerColors,
            triggerFamilies,
            battleLog: [
                ...round.battleLog,
                'Égalité persistante, la bataille continue !',
            ],
        };
        nextState = this.core.appendLog(nextState, 'Égalité persistante, la bataille continue !');
        nextState = this.setRoundState(nextState, meta, nextRound);
        return this.setCurrentPlayerWithAnnouncement(nextState, players, this.pickNextCurrentPlayerId(nextRound, nextState.turn?.currentPlayerId ?? 0), true);
    }
    finishRound(state, players, round, winnerId) {
        const meta = this.getMeta(state);
        const cards = this.collectTableCards(round.plays);
        const summary = {
            winnerId,
            cardsWon: cards.length,
            plays: round.plays,
            battleLog: round.battleLog,
        };
        const withCollectedCards = this.addCardsToWinner(meta, winnerId, cards);
        const nextMeta = this.applyWinnerCaptureBonus(withCollectedCards, players, round, winnerId);
        let nextState = {
            ...state,
            metadata: {
                ...nextMeta,
                roundState: null,
                lastRound: summary,
            },
        };
        nextState = this.logRound(nextState, summary, players);
        const finalWinner = this.detectWinner(nextMeta, players);
        if (finalWinner != null) {
            nextState = this.core.appendLog({ ...nextState, status: 'finished' }, `${(0, player_name_helper_1.resolvePlayerName)(players, finalWinner)} remporte Zig et Zag !`);
            nextState = {
                ...nextState,
                metadata: {
                    ...(nextState.metadata ?? {}),
                    winnerId: finalWinner,
                },
            };
        }
        else {
            nextState = this.turns.advanceTurn(nextState);
            const ensured = this.ensureRoundState(nextState, players);
            nextState = this.setCurrentPlayerWithAnnouncement(ensured.state, players, this.pickNextCurrentPlayerId(ensured.round, ensured.state.turn?.currentPlayerId ?? 0), true);
        }
        return nextState;
    }
    logRound(state, summary, players) {
        let next = state;
        if (summary.winnerId != null && summary.cardsWon > 0) {
            next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerName)(players, summary.winnerId)} remporte ${summary.cardsWon} cartes.`);
        }
        return next;
    }
    appendRevealLogs(state, players, round, onlyPlayers) {
        let next = state;
        const filter = Array.isArray(onlyPlayers) && onlyPlayers.length
            ? new Set(onlyPlayers)
            : null;
        for (const play of round.plays ?? []) {
            if (filter && !filter.has(play.playerId))
                continue;
            if (round.stage === 'selection' && play.lostByNoCard) {
                next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerName)(players, play.playerId)} n'a plus de cartes.`);
                continue;
            }
            if (play.faceUpCard) {
                next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerName)(players, play.playerId)} dévoile ${this.formatCardLabel(play.faceUpCard)}.`);
            }
        }
        return next;
    }
    appendCollectiveRevealLog(state, players, round, onlyPlayers) {
        const filter = Array.isArray(onlyPlayers) && onlyPlayers.length
            ? new Set(onlyPlayers)
            : null;
        const revealPlayers = (round.plays ?? [])
            .filter((play) => {
            if (filter && !filter.has(play.playerId))
                return false;
            return Boolean(play.faceUpCard);
        })
            .map((play) => (0, player_name_helper_1.resolvePlayerName)(players, play.playerId));
        if (revealPlayers.length <= 1) {
            return state;
        }
        const summary = revealPlayers.length === 2
            ? `${revealPlayers[0]} et ${revealPlayers[1]} dévoilent leurs cartes.`
            : `${revealPlayers.slice(0, -1).join(', ')} et ${revealPlayers[revealPlayers.length - 1]} dévoilent leurs cartes.`;
        return this.core.appendLog(state, summary);
    }
    hasSelectionJoker(round) {
        return (round.plays ?? []).some((play) => {
            if (!play.faceUpCard)
                return false;
            const def = zig_et_zag_cards_1.ZIG_ET_ZAG_CARD_BY_ID[play.faceUpCard];
            return def?.type === 'joker';
        });
    }
    setCurrentPlayer(state, playerId) {
        return {
            ...state,
            turn: {
                ...(state.turn ?? { direction: 1 }),
                currentPlayerId: playerId,
                direction: 1,
            },
        };
    }
    setCurrentPlayerWithAnnouncement(state, players, playerId, force = false) {
        const previousPlayerId = state.turn?.currentPlayerId ?? null;
        const next = this.setCurrentPlayer(state, playerId);
        if (!force &&
            typeof previousPlayerId === 'number' &&
            previousPlayerId === playerId) {
            return next;
        }
        return this.core.appendLog(next, `C'est au tour de ${(0, player_name_helper_1.resolvePlayerName)(players, playerId)}.`);
    }
    setRoundState(state, metadata, round) {
        return {
            ...state,
            metadata: {
                ...metadata,
                roundState: round,
            },
        };
    }
    getMeta(state) {
        return (state.metadata ?? {});
    }
    ensureRoundState(state, players) {
        const meta = this.getMeta(state);
        if (meta.roundState) {
            const normalized = this.normalizeRoundState(meta.roundState);
            const nextState = this.setRoundState(state, meta, normalized);
            return { state: nextState, round: normalized };
        }
        const safePlayers = Array.isArray(players) ? players : [];
        const round = (0, round_state_helper_1.buildInitialRoundState)(meta, safePlayers);
        const normalized = this.normalizeRoundState(round);
        const nextState = this.setRoundState(state, meta, normalized);
        return { state: nextState, round: normalized };
    }
    normalizeRoundState(round) {
        const asNumberOrNull = (value) => {
            if (typeof value === 'number' && Number.isFinite(value))
                return value;
            if (typeof value === 'string') {
                const n = Number(value.trim());
                return Number.isFinite(n) ? n : null;
            }
            return null;
        };
        const normalizeIdList = (list) => {
            const arr = Array.isArray(list) ? list : [];
            return arr
                .map((v) => asNumberOrNull(v))
                .filter((v) => typeof v === 'number');
        };
        const plays = Array.isArray(round?.plays) ? round.plays : [];
        const normalizedPlays = plays
            .map((play) => {
            const pid = asNumberOrNull(play?.playerId);
            if (pid == null)
                return null;
            return {
                ...play,
                playerId: pid,
                playedCards: Array.isArray(play?.playedCards) ? play.playedCards : [],
            };
        })
            .filter((p) => Boolean(p));
        return {
            ...round,
            plays: normalizedPlays,
            waitingPlayers: normalizeIdList(round?.waitingPlayers),
            tiedPlayers: normalizeIdList(round?.tiedPlayers),
        };
    }
    pickNextCurrentPlayerId(round, fallback) {
        const waiting = Array.isArray(round?.waitingPlayers)
            ? round.waitingPlayers
            : [];
        if (!waiting.length)
            return fallback;
        return waiting[0] ?? fallback;
    }
    recordPlayedCard(round, playerId, cardId) {
        const plays = round.plays.map((play) => play.playerId === playerId ? { ...play } : play);
        const entry = plays.find((play) => play.playerId === playerId);
        if (!entry) {
            return round;
        }
        entry.playedCards = [...entry.playedCards, cardId];
        if (round.stage === 'battle_face_down') {
            entry.faceDownCard = cardId;
        }
        else {
            entry.faceUpCard = cardId;
            entry.invalidJoker =
                round.stage !== 'selection' && !(0, round_state_helper_1.isCardAllowed)(round, playerId, cardId);
        }
        return {
            ...round,
            plays,
        };
    }
    playCardWithId(state, players, meta, round, playerId, cardId) {
        const { metadata: drainedMeta, removed } = (0, round_state_helper_1.removeCardFromHand)(meta, playerId, cardId);
        if (!removed) {
            return state;
        }
        const nextRound = this.recordPlayedCard(round, playerId, cardId);
        nextRound.waitingPlayers = this.normalizeWaitingPlayers(nextRound).filter((pid) => pid !== playerId);
        let nextState = this.setRoundState(state, drainedMeta, nextRound);
        nextState = this.setCurrentPlayerWithAnnouncement(nextState, players, this.pickNextCurrentPlayerId(nextRound, playerId));
        if (!nextRound.waitingPlayers.length) {
            nextState = this.finalizeStage(nextState, players);
        }
        return nextState;
    }
    isWaitingPlayer(round, playerId) {
        const waiting = this.normalizeWaitingPlayers(round);
        return waiting.length > 0 && waiting[0] === playerId;
    }
    normalizeWaitingPlayers(round) {
        return (round.waitingPlayers ?? [])
            .map((value) => {
            if (typeof value === 'number' && Number.isFinite(value))
                return value;
            if (typeof value === 'string') {
                const n = Number(value.trim());
                return Number.isFinite(n) ? n : null;
            }
            return null;
        })
            .filter((value) => typeof value === 'number');
    }
    collectTableCards(plays) {
        return plays.flatMap((play) => play.playedCards);
    }
    evaluateFaceUpPlays(round) {
        const faceUpResults = round.plays
            .filter((play) => play.faceUpCard && !play.lostByNoCard)
            .map((play) => {
            const def = zig_et_zag_cards_1.ZIG_ET_ZAG_CARD_BY_ID[play.faceUpCard];
            return def ? { playerId: play.playerId, value: def.value } : null;
        })
            .filter((entry) => Boolean(entry));
        if (!faceUpResults.length) {
            return { winnerId: null, tiePlayers: [] };
        }
        const maxValue = Math.max(...faceUpResults.map((entry) => entry.value));
        const winners = faceUpResults
            .filter((entry) => entry.value === maxValue)
            .map((entry) => entry.playerId);
        return {
            winnerId: winners.length === 1 ? winners[0] : null,
            tiePlayers: winners,
        };
    }
    addCardsToWinner(metadata, winnerId, cards) {
        if (winnerId == null) {
            return metadata;
        }
        const decks = { ...(metadata.playerDecks ?? {}) };
        const hand = Array.isArray(decks[winnerId]) ? [...decks[winnerId]] : [];
        decks[winnerId] = [...hand, ...cards];
        return {
            ...metadata,
            playerDecks: decks,
        };
    }
    applyWinnerCaptureBonus(metadata, players, round, winnerId) {
        if (winnerId == null) {
            return metadata;
        }
        const playerIds = (Array.isArray(players) ? players : [])
            .map((player) => player?.id)
            .filter((id) => typeof id === 'number');
        if (playerIds.length !== 2) {
            return metadata;
        }
        const loserId = playerIds.find((id) => id !== winnerId);
        if (loserId == null) {
            return metadata;
        }
        const winnerPlayCount = round.plays.find((play) => play.playerId === winnerId)?.playedCards
            ?.length ?? 0;
        if (winnerPlayCount <= 0) {
            return metadata;
        }
        const decks = { ...(metadata.playerDecks ?? {}) };
        const winnerDeck = Array.isArray(decks[winnerId])
            ? [...decks[winnerId]]
            : [];
        const loserDeck = Array.isArray(decks[loserId]) ? [...decks[loserId]] : [];
        if (!loserDeck.length) {
            return metadata;
        }
        const moved = loserDeck.splice(0, Math.min(winnerPlayCount, loserDeck.length));
        if (!moved.length) {
            return metadata;
        }
        decks[winnerId] = [...winnerDeck, ...moved];
        decks[loserId] = loserDeck;
        return {
            ...metadata,
            playerDecks: decks,
        };
    }
    detectWinner(metadata, players) {
        const playerIds = (players ?? [])
            .map((player) => player?.id)
            .filter((id) => typeof id === 'number');
        const alive = playerIds.filter((playerId) => (metadata.playerDecks[playerId]?.length ?? 0) > 0);
        if (alive.length === 1) {
            return alive[0];
        }
        const ownerOfAll = playerIds.find((playerId) => (metadata.playerDecks[playerId]?.length ?? 0) ===
            zig_et_zag_cards_1.ZIG_ET_ZAG_TOTAL_CARDS);
        return ownerOfAll ?? null;
    }
    formatCardLabel(cardId) {
        return zig_et_zag_cards_1.ZIG_ET_ZAG_CARD_BY_ID[cardId]?.name ?? cardId;
    }
    getActorId(action, state) {
        const actorFromMeta = action.meta?.actorId;
        if (typeof actorFromMeta === 'number') {
            return actorFromMeta;
        }
        return state.turn?.currentPlayerId ?? null;
    }
};
exports.ZigEtZagActionService = ZigEtZagActionService;
exports.ZigEtZagActionService = ZigEtZagActionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [game_core_service_1.GameCoreService,
        turn_flow_service_1.TurnFlowService,
        random_service_1.RandomService])
], ZigEtZagActionService);
//# sourceMappingURL=zig-et-zag-action.service.js.map