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
exports.VoyageActionService = void 0;
const common_1 = require("@nestjs/common");
const action_service_helper_1 = require("../../../../actions/action-service.helper");
const player_name_helper_1 = require("../../../../modules/turn-policies/player-name.helper");
const game_core_service_1 = require("../../../../core/services/game-core.service");
const random_service_1 = require("../../../../modules/random/services/random.service");
const turn_flow_service_1 = require("../../../../modules/turn/services/turn-flow.service");
const deck_policies_service_1 = require("../../../../modules/deck-policies/services/deck-policies.service");
let VoyageActionService = class VoyageActionService {
    random;
    turns;
    core;
    deckPolicies;
    constructor(random, turns, core, deckPolicies) {
        this.random = random;
        this.turns = turns;
        this.core = core;
        this.deckPolicies = deckPolicies;
    }
    applyActions(state, actions) {
        const next = (0, action_service_helper_1.applyActionsSequentially)(state, actions, (next, action) => {
            const type = (0, action_service_helper_1.normalizeActionType)(action);
            return (0, action_service_helper_1.dispatchByActionType)(type, {
                roll: () => {
                    next = this.handleRoll(next);
                    return next;
                },
                draw: () => {
                    next = this.handleDraw(next);
                    return next;
                },
                answer_quiz: () => {
                    next = this.handleAnswerQuiz(next, action);
                    return next;
                },
                choose_target: () => {
                    next = this.handleChooseTarget(next, action);
                    return next;
                },
            }, () => next);
        });
        return next;
    }
    handleRoll(state) {
        if (String(state.status ?? '').toLowerCase() !== 'started')
            return state;
        const currentId = state.turn?.currentPlayerId ?? null;
        if (currentId == null)
            return state;
        if (state.pending)
            return state;
        const meta0 = this.getMeta(state);
        const rng = this.random.rollDice(meta0, 6);
        const roll = rng.roll;
        let meta = { ...meta0, ...rng.meta };
        let next = {
            ...state,
            lastRoll: roll,
            metadata: { ...(state.metadata ?? {}), ...meta },
        };
        next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, currentId)} lance le dé : "${roll}".`);
        next = this.move(next, currentId, roll);
        next = this.applyLanding(next, currentId, { kind: 'none' });
        meta = this.getMeta(next);
        if (meta.winnerId != null)
            return { ...next, status: 'finished' };
        if (next.pending)
            return next;
        return this.advanceTurnWithCountdown(next);
    }
    handleDraw(state) {
        if (String(state.status ?? '').toLowerCase() !== 'started')
            return state;
        const pending = state.pending;
        if (!pending || pending.type !== 'draw')
            return state;
        const playerId = typeof pending.playerId === 'number'
            ? pending.playerId
            : (state.turn?.currentPlayerId ?? null);
        if (playerId == null)
            return state;
        const deckType = toText(asRecord(pending.data).deck).trim();
        let next = { ...state, pending: null };
        const meta0 = this.getMeta(next);
        const drawn = this.drawCard(meta0, deckType);
        next = { ...next, metadata: { ...(next.metadata ?? {}), ...drawn.meta } };
        if (!drawn.card) {
            next = this.core.appendLog(next, 'Plus de cartes.');
            return this.advanceTurnWithCountdown(next);
        }
        next = this.core.appendLog(next, `Carte : ${drawn.card.title}.`);
        next = this.applyCard(next, playerId, deckType, drawn.card);
        const meta = this.getMeta(next);
        if (meta.winnerId != null)
            return { ...next, status: 'finished' };
        if (next.pending)
            return next;
        return this.advanceTurnWithCountdown(next);
    }
    handleAnswerQuiz(state, action) {
        if (String(state.status ?? '').toLowerCase() !== 'started')
            return state;
        const pending = state.pending;
        if (!pending || pending.type !== 'quiz')
            return state;
        const playerId = typeof pending.playerId === 'number'
            ? pending.playerId
            : (state.turn?.currentPlayerId ?? null);
        if (playerId == null)
            return state;
        const meta0 = this.getMeta(state);
        const quiz = meta0.pendingQuiz;
        if (!quiz || quiz.playerId !== playerId)
            return state;
        const payload = asRecord(action?.payload ?? {});
        const answerRaw = toText(payload.answer ?? payload.choice ?? payload.value).trim();
        const choiceIndex = typeof payload.choiceIndex === 'number' &&
            Number.isFinite(payload.choiceIndex)
            ? Math.trunc(payload.choiceIndex)
            : null;
        const choice = choiceIndex != null &&
            Array.isArray(quiz.choices) &&
            quiz.choices[choiceIndex]
            ? String(quiz.choices[choiceIndex]).trim()
            : answerRaw;
        const ok = quiz.answer != null
            ? normalize(choice) === normalize(quiz.answer)
            : false;
        let next = { ...state, pending: null };
        let meta = {
            ...meta0,
            pendingQuiz: null,
        };
        next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
        next = this.core.appendLog(next, ok ? 'Bonne réponse !' : 'Mauvaise réponse.');
        if (ok) {
            next = this.incrementCollection(next, playerId, 'legend');
            if (typeof quiz.successDelta === 'number' && quiz.successDelta !== 0) {
                const delta = Math.trunc(quiz.successDelta);
                next = this.core.appendLog(next, `Bonus : déplacement ${delta}.`);
                next = this.move(next, playerId, delta);
                next = this.applyLanding(next, playerId, { kind: 'none' });
            }
        }
        else {
            next = this.discardDrawnCard(next, 'legend', quiz.card, { keep: false });
        }
        meta = this.getMeta(next);
        if (meta.winnerId != null)
            return { ...next, status: 'finished' };
        return this.advanceTurnWithCountdown(next);
    }
    handleChooseTarget(state, action) {
        if (String(state.status ?? '').toLowerCase() !== 'started')
            return state;
        const pending = state.pending;
        if (!pending || pending.type !== 'choose_target')
            return state;
        const playerId = typeof pending.playerId === 'number'
            ? pending.playerId
            : (state.turn?.currentPlayerId ?? null);
        if (playerId == null)
            return state;
        const targetId = Number(asRecord(action?.payload).targetPlayerId);
        if (!Number.isFinite(targetId))
            return state;
        let next = { ...state, pending: null };
        const meta0 = this.getMeta(next);
        const kind = toText(asRecord(pending.data).kind).trim();
        const last = meta0.statuses?.lastTargetByActor?.[playerId] ?? null;
        if (last != null && last === targetId) {
            next = this.core.appendLog(next, 'Cible invalide : vous ne pouvez pas viser le même joueur deux fois de suite.');
            return { ...next, pending };
        }
        if (kind === 'swap') {
            next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, playerId)} échange sa place avec ${(0, player_name_helper_1.resolvePlayerNameFromState)(next, targetId)}.`);
            next = this.swapPositions(next, playerId, targetId);
            next = this.setLastTarget(next, playerId, targetId);
        }
        if (kind === 'skip1') {
            next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, targetId)} perd son prochain tour.`);
            next = this.addSkip(next, targetId, 1);
            next = this.setLastTarget(next, playerId, targetId);
        }
        if (kind === 'swap_card') {
            const count = Math.max(1, Math.trunc(Number(pending?.data?.count ?? 1)));
            next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, playerId)} échange ${count} carte(s) avec ${(0, player_name_helper_1.resolvePlayerNameFromState)(next, targetId)}.`);
            next = this.exchangeRandomCards(next, playerId, targetId, count);
            next = this.setLastTarget(next, playerId, targetId);
        }
        const meta = this.getMeta(next);
        if (meta.winnerId != null)
            return { ...next, status: 'finished' };
        return this.advanceTurnWithCountdown(next);
    }
    applyLanding(state, playerId, context) {
        let next = state;
        const meta = this.getMeta(next);
        const tiles = Array.isArray(meta.tiles) ? meta.tiles : [];
        const pos = meta.positions?.[playerId] ?? 0;
        const tile = tiles[pos];
        if (!tile)
            return next;
        const label = tile.label?.trim()
            ? tile.label.trim()
            : tile.title?.trim()
                ? tile.title.trim()
                : `Case ${pos + 1}`;
        next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, playerId)} place ${this.pawnLabel(next, playerId)} en case ${pos + 1} (${label}).`);
        if (tile.description && String(tile.description).trim()) {
            next = this.core.appendLog(next, String(tile.description).trim());
        }
        if (tile.type === 'finish') {
            const metaNow = this.getMeta(next);
            if (metaNow.finishCountdown == null) {
                const players = Array.isArray(next.players) ? next.players : [];
                const countdown = Math.max(0, players.length);
                const remainingTurns = Math.max(0, players.length - 1);
                const updated = {
                    ...metaNow,
                    finishCountdown: countdown,
                };
                next = { ...next, metadata: { ...(next.metadata ?? {}), ...updated } };
                next = this.core.appendLog(next, `Arrivée atteinte ! Les autres joueurs jouent encore ${remainingTurns} tour(s).`);
            }
            return next;
        }
        if (tile.type === 'rest') {
            next = this.core.appendLog(next, 'Repos : vous passez votre prochain tour.');
            return this.addSkip(next, playerId, 1);
        }
        if (tile.type === 'passage') {
            if (context.kind === 'from_passage')
                return next;
            const otherPlayers = this.otherPlayers(next, playerId);
            if (/\béchange\b/i.test(tile.description ?? '') && otherPlayers.length) {
                const pending = {
                    type: 'choose_target',
                    playerId,
                    blocking: true,
                    label: 'Choisir un joueur (échanger de place).',
                    data: {
                        kind: 'swap',
                        targets: otherPlayers.map((p) => ({ targetPlayerId: p.id })),
                    },
                    choices: otherPlayers.map((p) => p.username),
                };
                return { ...next, pending };
            }
            const delta = extractMoveDelta(tile.description ?? '');
            if (delta !== 0) {
                next = this.core.appendLog(next, `Passage : déplacement ${delta}.`);
                next = this.move(next, playerId, delta);
                return this.applyLanding(next, playerId, { kind: 'from_passage' });
            }
            return next;
        }
        if (tile.type === 'legend' ||
            tile.type === 'farce' ||
            tile.type === 'treasure' ||
            tile.type === 'landscape') {
            const pending = {
                type: 'draw',
                playerId,
                blocking: true,
                label: 'Piocher une carte (Espace).',
                data: { deck: tile.type },
            };
            return { ...next, pending };
        }
        return next;
    }
    applyCard(state, playerId, deckType, card) {
        let next = state;
        if (deckType === 'legend') {
            const quiz = this.parseQuizCard(playerId, card);
            if (quiz) {
                const pending = {
                    type: 'quiz',
                    playerId,
                    blocking: true,
                    label: 'Répondre au quiz.',
                    question: quiz.question,
                    choices: quiz.choices,
                    data: { cardId: card.id },
                };
                const meta0 = this.getMeta(next);
                const meta = { ...meta0, pendingQuiz: quiz };
                return {
                    ...next,
                    metadata: { ...(next.metadata ?? {}), ...meta },
                    pending,
                };
            }
            next = this.incrementCollection(next, playerId, 'legend');
            next = this.discardDrawnCard(next, 'legend', card, { keep: true });
            return this.applyGenericEffect(next, playerId, card.effect);
        }
        if (deckType === 'treasure') {
            next = this.incrementCollection(next, playerId, 'treasure');
            next = this.discardDrawnCard(next, 'treasure', card, { keep: true });
            return this.applyGenericEffect(next, playerId, card.effect);
        }
        if (deckType === 'landscape') {
            const keep = !/défauss/i.test(card.effect ?? '');
            if (keep)
                next = this.incrementCollection(next, playerId, 'landscape');
            next = this.discardDrawnCard(next, 'landscape', card, { keep });
            return this.applyGenericEffect(next, playerId, card.effect);
        }
        if (deckType === 'farce') {
            const keep = /gardez|conservez/i.test(card.effect ?? '');
            if (keep)
                next = this.incrementCollection(next, playerId, 'farce');
            next = this.discardDrawnCard(next, 'farce', card, { keep });
            return this.applyGenericEffect(next, playerId, card.effect);
        }
        return next;
    }
    applyGenericEffect(state, playerId, textRaw) {
        let next = state;
        const text = String(textRaw ?? '');
        if (/choisissez\s+un\s+joueur/i.test(text) &&
            /perd\s+son\s+prochain\s+tour/i.test(text)) {
            const otherPlayers = this.otherPlayers(next, playerId);
            if (otherPlayers.length) {
                const pending = {
                    type: 'choose_target',
                    playerId,
                    blocking: true,
                    label: 'Choisir un joueur (il perd son prochain tour).',
                    data: {
                        kind: 'skip1',
                        targets: otherPlayers.map((p) => ({ targetPlayerId: p.id })),
                    },
                    choices: otherPlayers.map((p) => p.username),
                };
                return { ...next, pending };
            }
        }
        if (/tirez\s+au\s+hasard\s+une\s+carte/i.test(text) &&
            /vous\s+la\s+perdez/i.test(text)) {
            const wantLegend = /l[ée]gende/i.test(text);
            const wantLandscape = /paysage/i.test(text);
            const wantTreasure = /tr[ée]sor/i.test(text);
            const wantFarce = /farce/i.test(text);
            next = this.loseRandomCard(next, playerId, {
                legend: wantLegend,
                landscape: wantLandscape,
                treasure: wantTreasure,
                farce: wantFarce,
            });
            return next;
        }
        const delta = extractMoveDelta(text);
        if (delta !== 0) {
            next = this.core.appendLog(next, `Déplacement ${delta}.`);
            next = this.move(next, playerId, delta);
            return this.applyLanding(next, playerId, { kind: 'none' });
        }
        const skip = extractSkipTurns(text);
        if (skip > 0) {
            next = this.core.appendLog(next, `Perdez ${skip} tour(s).`);
            return this.addSkip(next, playerId, skip);
        }
        if (/échange/i.test(text) && /carte/i.test(text)) {
            const count = extractCardCount(text);
            if (/second\s+joueur/i.test(text)) {
                const players = Array.isArray(next.players) ? next.players : [];
                const ids = players
                    .map((p) => p?.id)
                    .filter((id) => Number.isFinite(id));
                const targetId = ids.length >= 2 ? (ids[1] === playerId ? ids[0] : ids[1]) : null;
                if (targetId != null) {
                    next = this.core.appendLog(next, `Échange automatique avec ${(0, player_name_helper_1.resolvePlayerNameFromState)(next, targetId)}.`);
                    next = this.exchangeRandomCards(next, playerId, targetId, count);
                    return this.setLastTarget(next, playerId, targetId);
                }
            }
            const otherPlayers = this.otherPlayers(next, playerId);
            if (otherPlayers.length) {
                const pending = {
                    type: 'choose_target',
                    playerId,
                    blocking: true,
                    label: `Choisir un joueur (échanger ${count} carte(s)).`,
                    data: {
                        kind: 'swap_card',
                        count,
                        targets: otherPlayers.map((p) => ({ targetPlayerId: p.id })),
                    },
                    choices: otherPlayers.map((p) => p.username),
                };
                return { ...next, pending };
            }
        }
        if (/échange/i.test(text) && /position/i.test(text)) {
            if (/dernier\s+joueur/i.test(text)) {
                const other = this.otherPlayers(next, playerId);
                if (other.length) {
                    const meta = this.getMeta(next);
                    const last = other
                        .map((p) => p.id)
                        .sort((a, b) => (meta.positions?.[a] ?? 0) - (meta.positions?.[b] ?? 0))[0];
                    next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, playerId)} échange sa place avec ${(0, player_name_helper_1.resolvePlayerNameFromState)(next, last)}.`);
                    next = this.swapPositions(next, playerId, last);
                    return this.setLastTarget(next, playerId, last);
                }
            }
            const otherPlayers = this.otherPlayers(next, playerId);
            if (otherPlayers.length) {
                const pending = {
                    type: 'choose_target',
                    playerId,
                    blocking: true,
                    label: 'Choisir un joueur (échanger de place).',
                    data: {
                        kind: 'swap',
                        targets: otherPlayers.map((p) => ({ targetPlayerId: p.id })),
                    },
                    choices: otherPlayers.map((p) => p.username),
                };
                return { ...next, pending };
            }
        }
        return next;
    }
    exchangeRandomCards(state, aId, bId, count) {
        let next = state;
        for (let i = 0; i < count; i += 1) {
            const takeA = this.takeRandomCard(next, aId);
            next = takeA.state;
            const takeB = this.takeRandomCard(next, bId);
            next = takeB.state;
            if (takeA.kind)
                next = this.incrementCollection(next, bId, takeA.kind);
            if (takeB.kind)
                next = this.incrementCollection(next, aId, takeB.kind);
        }
        return next;
    }
    takeRandomCard(state, playerId) {
        const meta = this.getMeta(state);
        const c = meta.collections?.[playerId] ?? {
            legend: 0,
            farce: 0,
            treasure: 0,
            landscape: 0,
        };
        const candidates = [];
        if ((c.legend ?? 0) > 0)
            candidates.push('legend');
        if ((c.treasure ?? 0) > 0)
            candidates.push('treasure');
        if ((c.landscape ?? 0) > 0)
            candidates.push('landscape');
        if ((c.farce ?? 0) > 0)
            candidates.push('farce');
        if (!candidates.length)
            return { state, kind: null };
        const picked = this.random.pickOne(meta, candidates);
        let next = {
            ...state,
            metadata: { ...(state.metadata ?? {}), ...meta, ...picked.meta },
        };
        if (!picked.value)
            return { state: next, kind: null };
        next = this.decrementCollection(next, playerId, picked.value);
        return { state: next, kind: picked.value };
    }
    parseQuizCard(playerId, card) {
        const effect = String(card.effect ?? '');
        const choiceLines = effect
            .split(/\s*(?=[*]?[ABC]\))/i)
            .map((s) => s.trim())
            .filter((s) => /^[*]?[ABC]\)/i.test(s));
        if (!choiceLines.length)
            return null;
        const qMatch = effect.match(/question\s*:\s*([^?]+\?)/i);
        const question = (qMatch?.[1] ?? card.title ?? 'Quiz').trim();
        const choices = choiceLines.map((l) => l.replace(/^[*]?[ABC]\)\s*/i, '').trim());
        const answerLine = choiceLines.find((l) => l.trim().startsWith('*')) ?? '';
        const answer = answerLine
            ? answerLine.replace(/^[*]?[ABC]\)\s*/i, '').trim()
            : undefined;
        const successDelta = extractMoveDelta(effect);
        return {
            playerId,
            cardId: card.id,
            card,
            question,
            choices,
            answer,
            ...(successDelta ? { successDelta } : {}),
        };
    }
    drawCard(meta, deckType) {
        const deckId = deckType === 'legend'
            ? 'legend'
            : deckType === 'farce'
                ? 'farce'
                : deckType === 'treasure'
                    ? 'treasure'
                    : 'landscape';
        const decks = asRecord(meta.decks);
        const rawDeck = asRecord(decks[deckId]);
        const deck = {
            cards: Array.isArray(rawDeck.cards)
                ? rawDeck.cards
                : [],
            discard: Array.isArray(rawDeck.discard)
                ? rawDeck.discard
                : [],
        };
        const draw = this.deckPolicies.drawFromPile({
            meta,
            pile: Array.isArray(deck.cards) ? deck.cards : [],
            discard: Array.isArray(deck.discard) ? deck.discard : [],
            useWholeMetaRng: true,
            discardDrawnCard: false,
        });
        const nextMeta = {
            ...draw.meta,
            decks: {
                ...draw.meta.decks,
                [deckId]: {
                    cards: draw.pile,
                    discard: draw.discard,
                },
            },
        };
        return { card: draw.card, meta: nextMeta };
    }
    discardDrawnCard(state, deckType, card, options) {
        if (options.keep) {
            return state;
        }
        const meta = this.getMeta(state);
        const decks = asRecord(meta.decks);
        const rawDeck = asRecord(decks[deckType]);
        const deck = {
            cards: Array.isArray(rawDeck.cards)
                ? rawDeck.cards
                : [],
            discard: Array.isArray(rawDeck.discard)
                ? rawDeck.discard
                : [],
        };
        const discard = Array.isArray(deck?.discard) ? deck.discard : [];
        const nextMeta = {
            ...meta,
            decks: {
                ...meta.decks,
                [deckType]: {
                    cards: deck.cards,
                    discard: [...discard, card],
                },
            },
        };
        return { ...state, metadata: { ...(state.metadata ?? {}), ...nextMeta } };
    }
    move(state, playerId, delta) {
        const meta = this.getMeta(state);
        const tiles = Array.isArray(meta.tiles) ? meta.tiles : [];
        const max = Math.max(0, tiles.length - 1);
        const pos = meta.positions?.[playerId] ?? 0;
        const nextPos = bounce(pos + delta, max);
        const nextMeta = {
            ...meta,
            positions: { ...(meta.positions ?? {}), [playerId]: nextPos },
        };
        return { ...state, metadata: { ...(state.metadata ?? {}), ...nextMeta } };
    }
    swapPositions(state, a, b) {
        const meta = this.getMeta(state);
        const posA = meta.positions?.[a] ?? 0;
        const posB = meta.positions?.[b] ?? 0;
        const nextMeta = {
            ...meta,
            positions: { ...(meta.positions ?? {}), [a]: posB, [b]: posA },
        };
        return { ...state, metadata: { ...(state.metadata ?? {}), ...nextMeta } };
    }
    addSkip(state, playerId, turns) {
        const meta = this.getMeta(state);
        const current = meta.statuses?.skipTurn?.[playerId] ?? 0;
        const nextMeta = {
            ...meta,
            statuses: {
                ...meta.statuses,
                skipTurn: {
                    ...(meta.statuses.skipTurn ?? {}),
                    [playerId]: current + turns,
                },
            },
        };
        return { ...state, metadata: { ...(state.metadata ?? {}), ...nextMeta } };
    }
    incrementCollection(state, playerId, kind) {
        const meta = this.getMeta(state);
        const current = meta.collections?.[playerId] ?? {
            legend: 0,
            farce: 0,
            treasure: 0,
            landscape: 0,
        };
        const nextCollections = {
            ...(meta.collections ?? {}),
            [playerId]: { ...current, [kind]: current[kind] + 1 },
        };
        const nextMeta = { ...meta, collections: nextCollections };
        return { ...state, metadata: { ...(state.metadata ?? {}), ...nextMeta } };
    }
    decrementCollection(state, playerId, kind) {
        const meta = this.getMeta(state);
        const current = meta.collections?.[playerId] ?? {
            legend: 0,
            farce: 0,
            treasure: 0,
            landscape: 0,
        };
        const nextVal = Math.max(0, current[kind] - 1);
        const nextCollections = {
            ...(meta.collections ?? {}),
            [playerId]: { ...current, [kind]: nextVal },
        };
        const nextMeta = { ...meta, collections: nextCollections };
        return { ...state, metadata: { ...(state.metadata ?? {}), ...nextMeta } };
    }
    loseRandomCard(state, playerId, filter) {
        const meta = this.getMeta(state);
        const c = meta.collections?.[playerId] ?? {
            legend: 0,
            farce: 0,
            treasure: 0,
            landscape: 0,
        };
        const candidates = [];
        const allow = (k) => filter[k] !== false;
        if (allow('legend') && (c.legend ?? 0) > 0)
            candidates.push('legend');
        if (allow('landscape') && (c.landscape ?? 0) > 0)
            candidates.push('landscape');
        if (allow('treasure') && (c.treasure ?? 0) > 0)
            candidates.push('treasure');
        if (allow('farce') && (c.farce ?? 0) > 0)
            candidates.push('farce');
        if (!candidates.length) {
            return this.core.appendLog(state, 'Aucune carte à perdre.');
        }
        const picked = this.random.pickOne(meta, candidates);
        let next = {
            ...state,
            metadata: { ...(state.metadata ?? {}), ...meta, ...picked.meta },
        };
        if (!picked.value)
            return next;
        next = this.core.appendLog(next, `Vous perdez une carte (${picked.value}).`);
        return this.decrementCollection(next, playerId, picked.value);
    }
    advanceTurnWithCountdown(state) {
        const meta = this.getMeta(state);
        if (meta.finishCountdown == null)
            return this.turns.advanceTurn(state);
        const remaining = Number(meta.finishCountdown);
        const nextRemaining = Math.max(0, remaining - 1);
        let next = {
            ...state,
            metadata: {
                ...(state.metadata ?? {}),
                ...meta,
                finishCountdown: nextRemaining,
            },
        };
        next = this.turns.advanceTurn(next);
        if (nextRemaining <= 0) {
            return this.finishByScore(next);
        }
        return next;
    }
    finishByScore(state) {
        const meta = this.getMeta(state);
        const players = Array.isArray(state.players) ? state.players : [];
        const score = (id) => {
            const c = meta.collections?.[id] ?? {
                legend: 0,
                farce: 0,
                treasure: 0,
                landscape: 0,
            };
            const total = (c.legend ?? 0) +
                (c.farce ?? 0) +
                (c.treasure ?? 0) +
                (c.landscape ?? 0);
            return { total, legend: c.legend ?? 0 };
        };
        const ranked = players
            .map((p) => ({ id: p.id, ...score(p.id) }))
            .sort((a, b) => b.total - a.total || b.legend - a.legend || a.id - b.id);
        const winnerId = ranked[0]?.id ?? null;
        const nextMeta = { ...meta, winnerId };
        let next = {
            ...state,
            status: 'finished',
            metadata: { ...(state.metadata ?? {}), ...nextMeta },
        };
        if (winnerId != null) {
            next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, winnerId)} remporte la partie !`);
        }
        return next;
    }
    otherPlayers(state, me) {
        const players = Array.isArray(state.players) ? state.players : [];
        return players
            .filter((p) => p?.id != null && p.id !== me)
            .map((p) => ({
            id: p.id,
            username: (0, player_name_helper_1.resolvePlayerNameFromState)(state, p.id),
        }));
    }
    getMeta(state) {
        return (state.metadata ?? {});
    }
    setLastTarget(state, actorId, targetId) {
        const meta = this.getMeta(state);
        const last = meta.statuses?.lastTargetByActor ?? {};
        const nextMeta = {
            ...meta,
            statuses: {
                ...meta.statuses,
                lastTargetByActor: { ...(last ?? {}), [actorId]: targetId },
            },
        };
        return { ...state, metadata: { ...(state.metadata ?? {}), ...nextMeta } };
    }
    pawnLabel(state, id) {
        const players = Array.isArray(state.players) ? state.players : [];
        const player = players.find((p) => p?.id === id);
        const playerRecord = asRecord(player);
        const explicitLabel = toText(playerRecord.pawnLabel).trim();
        if (explicitLabel)
            return `"${explicitLabel}"`;
        const pawnId = toText(playerRecord.pawn).trim();
        if (pawnId)
            return `"${pawnId}"`;
        const fallback = (0, player_name_helper_1.resolvePlayerNameFromState)(state, id);
        return `"${fallback}"`;
    }
};
exports.VoyageActionService = VoyageActionService;
exports.VoyageActionService = VoyageActionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [random_service_1.RandomService,
        turn_flow_service_1.TurnFlowService,
        game_core_service_1.GameCoreService,
        deck_policies_service_1.DeckPoliciesService])
], VoyageActionService);
function bounce(target, max) {
    if (max <= 0)
        return 0;
    if (target < 0)
        return 0;
    if (target === max)
        return max;
    if (target < max)
        return target;
    const over = target - max;
    return max - over;
}
function normalize(value) {
    return String(value ?? '')
        .trim()
        .toLowerCase();
}
function extractMoveDelta(text) {
    const parse = (raw) => {
        const v = raw.trim().toLowerCase();
        const n = Number(v);
        if (Number.isFinite(n))
            return n;
        const map = {
            un: 1,
            une: 1,
            deux: 2,
            trois: 3,
            quatre: 4,
            cinq: 5,
            six: 6,
        };
        return map[v] ?? 0;
    };
    const forward = text.match(/avance(?:z)?\s+de\s+([0-9]+|un|une|deux|trois|quatre|cinq|six)\s+case/i);
    if (forward)
        return parse(forward[1]);
    const backward = text.match(/recule(?:z)?\s+de\s+([0-9]+|un|une|deux|trois|quatre|cinq|six)\s+case/i);
    if (backward)
        return -parse(backward[1]);
    return 0;
}
function extractSkipTurns(text) {
    if (/Passez trois tours/i.test(text))
        return 3;
    if (/Passez deux tours/i.test(text))
        return 2;
    if (/Passez votre tour/i.test(text) || /Passe ton prochain tour/i.test(text))
        return 1;
    return 0;
}
function extractCardCount(text) {
    if (/\b2\b/.test(text) || /\bdeux\b/i.test(text))
        return 2;
    if (/\b3\b/.test(text) || /\btrois\b/i.test(text))
        return 3;
    return 1;
}
function asRecord(value) {
    return value && typeof value === 'object'
        ? value
        : {};
}
function toText(value) {
    if (typeof value === 'string')
        return value;
    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }
    return '';
}
//# sourceMappingURL=voyage-action.service.js.map