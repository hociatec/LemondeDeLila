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
exports.GaloponsActionService = void 0;
const common_1 = require("@nestjs/common");
const action_service_helper_1 = require("../../../../actions/action-service.helper");
const player_name_helper_1 = require("../../../../modules/turn-policies/player-name.helper");
const game_core_service_1 = require("../../../../core/services/game-core.service");
const random_service_1 = require("../../../../modules/random/services/random.service");
const turn_flow_service_1 = require("../../../../modules/turn/services/turn-flow.service");
const deck_policies_service_1 = require("../../../../modules/deck-policies/services/deck-policies.service");
function asRecord(value) {
    return value != null && typeof value === 'object'
        ? value
        : {};
}
function asPartialMeta(value) {
    return value != null && typeof value === 'object'
        ? value
        : {};
}
let GaloponsActionService = class GaloponsActionService {
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
        if (state.pending)
            return state;
        const currentId = state.turn?.currentPlayerId ?? null;
        if (currentId == null)
            return state;
        let meta = this.getMeta(state);
        const iou = meta.ious?.[currentId] ?? null;
        if (iou && typeof iou === 'object') {
            const creditors = Object.keys(iou)
                .map(Number)
                .filter((id) => Number.isFinite(id) && (iou[id] ?? 0) > 0);
            if (creditors.length && (meta.apples?.[currentId] ?? 0) > 0) {
                const creditorId = creditors[0];
                const nextApples = { ...(meta.apples ?? {}) };
                nextApples[currentId] = (nextApples[currentId] ?? 0) - 1;
                nextApples[creditorId] = (nextApples[creditorId] ?? 0) + 1;
                const nextIous = { ...(meta.ious ?? {}) };
                const mine = { ...(nextIous[currentId] ?? {}) };
                mine[creditorId] = Math.max(0, (mine[creditorId] ?? 0) - 1);
                nextIous[currentId] = mine;
                meta = { ...meta, apples: nextApples, ious: nextIous };
            }
        }
        const rng = this.random.rollDice(meta, 6);
        meta = { ...meta, ...asPartialMeta(rng.meta) };
        const roll = rng.roll;
        let next = {
            ...state,
            lastRoll: roll,
            metadata: { ...(state.metadata ?? {}), ...meta },
        };
        next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, currentId)} lance le d� : "${roll}".`);
        next = this.move(next, currentId, roll);
        next = this.applyLanding(next, currentId);
        meta = this.getMeta(next);
        if (meta.winnerId != null)
            return { ...next, status: 'finished' };
        if (next.pending)
            return next;
        if (meta.finish?.triggered && meta.finish.pendingIds.length === 0) {
            return this.finishGame(next);
        }
        const keepTurn = asRecord(meta).keepTurn === true;
        if (keepTurn) {
            meta = { ...meta };
            delete asRecord(meta).keepTurn;
            next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
            return this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, currentId)} rejoue.`);
        }
        if (meta.finish?.triggered) {
            const pendingIds = meta.finish.pendingIds.filter((id) => id !== currentId);
            meta = { ...meta, finish: { ...meta.finish, pendingIds } };
            next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
        }
        return this.turns.advanceTurn(next);
    }
    handleChooseTarget(state, action) {
        if (String(state.status ?? '').toLowerCase() !== 'started')
            return state;
        const currentId = state.turn?.currentPlayerId ?? null;
        if (currentId == null)
            return state;
        const pending = state.pending;
        const pendingRow = asRecord(pending);
        if (!pending ||
            pendingRow.type !== 'choose_target' ||
            Number(pendingRow.playerId ?? null) !== currentId)
            return state;
        const payload = asRecord(action.payload);
        const targetPlayerId = Number(payload.targetPlayerId);
        if (!Number.isFinite(targetPlayerId))
            return state;
        let meta = this.getMeta(state);
        const ctx = meta.pendingContext ?? null;
        if (!ctx || ctx.actorId !== currentId)
            return { ...state, pending: null };
        let next = {
            ...state,
            pending: null,
            metadata: { ...(state.metadata ?? {}), ...meta, pendingContext: null },
        };
        if (ctx.kind === 'pair_advance') {
            next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, currentId)} et ${(0, player_name_helper_1.resolvePlayerNameFromState)(next, targetPlayerId)} avancent d'une case.`);
            next = this.move(next, currentId, 1);
            next = this.move(next, targetPlayerId, 1);
            next = this.applyLanding(next, currentId);
            if (ctx.replayAfter)
                return this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, currentId)} rejoue.`);
            return this.turns.advanceTurn(next);
        }
        if (ctx.kind === 'give_apple') {
            const a = meta.apples?.[currentId] ?? 0;
            if (a <= 0) {
                next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, currentId)} n'a pas de pomme � donner.`);
                if (ctx.replayAfter)
                    return this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, currentId)} rejoue.`);
                return this.turns.advanceTurn(next);
            }
            meta = this.getMeta(next);
            const nextApples = {
                ...meta.apples,
                [currentId]: a - 1,
                [targetPlayerId]: (meta.apples?.[targetPlayerId] ?? 0) + 1,
            };
            const nextIous = { ...(meta.ious ?? {}) };
            const forTarget = { ...(nextIous[targetPlayerId] ?? {}) };
            forTarget[currentId] = (forTarget[currentId] ?? 0) + 1;
            nextIous[targetPlayerId] = forTarget;
            meta = { ...meta, apples: nextApples, ious: nextIous };
            next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
            next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, currentId)} donne une pomme � ${(0, player_name_helper_1.resolvePlayerNameFromState)(next, targetPlayerId)}.`);
            next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, targetPlayerId)} devra rendre une pomme plus tard.`);
            if (ctx.replayAfter)
                return this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, currentId)} rejoue.`);
            return this.turns.advanceTurn(next);
        }
        if (ctx.kind === 'help_advance') {
            next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, currentId)} aide ${(0, player_name_helper_1.resolvePlayerNameFromState)(next, targetPlayerId)} : +2 cases.`);
            next = this.move(next, targetPlayerId, 2);
            meta = this.getMeta(next);
            meta = {
                ...meta,
                apples: {
                    ...meta.apples,
                    [currentId]: (meta.apples?.[currentId] ?? 0) + 1,
                },
            };
            next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
            next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, currentId)} re�oit une pomme en remerciement.`);
            if (ctx.replayAfter)
                return this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, currentId)} rejoue.`);
            return this.turns.advanceTurn(next);
        }
        return this.turns.advanceTurn(next);
    }
    handleDraw(state) {
        if (String(state.status ?? '').toLowerCase() !== 'started')
            return state;
        const pending = state.pending;
        const pendingRow = asRecord(pending);
        if (!pending || pendingRow.type !== 'draw')
            return state;
        const playerId = typeof pendingRow.playerId === 'number'
            ? pendingRow.playerId
            : (state.turn?.currentPlayerId ?? null);
        if (!playerId)
            return state;
        const cleared = { ...state, pending: null };
        return this.applyDrawCard(cleared, playerId);
    }
    applyLanding(state, playerId) {
        let next = state;
        let meta = this.getMeta(next);
        const pos = meta.positions?.[playerId] ?? 0;
        const tile = meta.tiles[pos];
        if (!tile)
            return next;
        next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, playerId)} place ${this.pawnLabel(next, playerId)} en case ${tile.n} (${tile.title}).`);
        if (tile.type === 'card') {
            next = this.core.appendLog(next, `Piochez une carte Aventure.`);
        }
        else if (tile.type === 'bonus') {
            next = this.core.appendLog(next, `Gagnez des pommes.`);
        }
        else if (tile.type === 'skip') {
            next = this.core.appendLog(next, `Passez des tours.`);
        }
        else if (tile.type === 'finish') {
            next = this.core.appendLog(next, `�curie finale.`);
        }
        if (tile.type === 'finish') {
            if (!meta.finish?.triggered) {
                const others = Object.keys(meta.positions ?? {})
                    .map(Number)
                    .filter((id) => Number.isFinite(id) && id !== playerId);
                meta = {
                    ...meta,
                    apples: {
                        ...meta.apples,
                        [playerId]: (meta.apples?.[playerId] ?? 0) + 1,
                    },
                    finish: {
                        triggered: true,
                        starterId: playerId,
                        pendingIds: others,
                        bonusGiven: true,
                    },
                };
                next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
                next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, playerId)} atteint l'�curie finale (+1 pomme).`);
            }
            return next;
        }
        const occupant = this.findOccupant(meta, playerId, pos);
        if (occupant != null) {
            next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, playerId)} rattrape ${(0, player_name_helper_1.resolvePlayerNameFromState)(next, occupant)} : ${(0, player_name_helper_1.resolvePlayerNameFromState)(next, occupant)} recule de 5 cases.`);
            next = this.move(next, occupant, -5);
            meta = this.getMeta(next);
        }
        if (tile.type === 'bonus') {
            const gain = typeof tile.apples === 'number' ? tile.apples : 1;
            meta = {
                ...meta,
                apples: {
                    ...meta.apples,
                    [playerId]: (meta.apples?.[playerId] ?? 0) + gain,
                },
            };
            next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
            return this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, playerId)} gagne ${gain} pomme(s).`);
        }
        if (tile.type === 'skip') {
            const turns = typeof tile.skipTurns === 'number' ? tile.skipTurns : 1;
            const curr = meta.statuses?.skipTurn?.[playerId] ?? 0;
            meta = {
                ...meta,
                statuses: {
                    ...meta.statuses,
                    skipTurn: {
                        ...(meta.statuses.skipTurn ?? {}),
                        [playerId]: curr + turns,
                    },
                },
            };
            next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
            return this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, playerId)} passe ${turns} tour(s).`);
        }
        if (tile.type === 'card') {
            return {
                ...next,
                pending: {
                    type: 'draw',
                    playerId,
                    blocking: true,
                    label: 'Piocher une carte Aventure (Espace).',
                },
            };
        }
        return next;
    }
    applyDrawCard(state, playerId) {
        let next = state;
        let meta = this.getMeta(next);
        const draw = this.drawCard(meta);
        meta = draw.meta;
        next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
        if (!draw.card)
            return next;
        next = this.core.appendLog(next, `Carte Aventure : ${draw.card.text}`);
        return this.applyCard(next, playerId, draw.card);
    }
    applyCard(state, playerId, card) {
        let next = state;
        let meta = this.getMeta(next);
        const text = card.text;
        const replayAfter = /Rejouez/i.test(text);
        if (/Donnez-lui une pomme/i.test(text)) {
            const targets = this.otherPlayers(next, playerId);
            const pending = {
                type: 'choose_target',
                label: 'Choisissez un joueur dans la liste, puis Entr�e.',
                playerId,
                blocking: true,
                choices: targets.map((t) => t.username),
                data: {
                    targets: targets.map((t) => ({
                        targetPlayerId: t.id,
                        targetUsername: t.username,
                    })),
                },
            };
            meta = {
                ...meta,
                pendingContext: { kind: 'give_apple', actorId: playerId, replayAfter },
            };
            return {
                ...next,
                pending,
                metadata: { ...(next.metadata ?? {}), ...meta },
            };
        }
        if (/Rejouez/i.test(text)) {
            asRecord(meta).keepTurn = true;
            next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
        }
        const apples = text.match(/Recevez\s+(\d+)\s+jetons?\s+Pomme/i);
        if (apples) {
            const gain = Number(apples[1]) || 0;
            meta = {
                ...meta,
                apples: {
                    ...meta.apples,
                    [playerId]: (meta.apples?.[playerId] ?? 0) + gain,
                },
            };
            next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
            return this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, playerId)} gagne ${gain} pomme(s).`);
        }
        if (/Recevez un jeton pomme/i.test(text) ||
            /Gagnez 1 jeton Pomme/i.test(text)) {
            meta = {
                ...meta,
                apples: {
                    ...meta.apples,
                    [playerId]: (meta.apples?.[playerId] ?? 0) + 1,
                },
            };
            next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
            return this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, playerId)} gagne 1 pomme.`);
        }
        if (/Passez votre tour/i.test(text)) {
            const curr = meta.statuses?.skipTurn?.[playerId] ?? 0;
            meta = {
                ...meta,
                statuses: {
                    ...meta.statuses,
                    skipTurn: { ...(meta.statuses.skipTurn ?? {}), [playerId]: curr + 1 },
                },
            };
            return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
        }
        if (/Tous les joueurs restent sur place pendant un tour/i.test(text)) {
            const skip = { ...(meta.statuses.skipTurn ?? {}) };
            for (const id of Object.keys(meta.positions ?? {})
                .map(Number)
                .filter(Number.isFinite)) {
                skip[id] = (skip[id] ?? 0) + 1;
            }
            meta = { ...meta, statuses: { ...meta.statuses, skipTurn: skip } };
            return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
        }
        if (/Choisissez un joueur et avancez tout les deux d'une case/i.test(text)) {
            const targets = this.otherPlayers(next, playerId);
            const pending = {
                type: 'choose_target',
                label: 'Choisissez un joueur dans la liste, puis Entr�e.',
                playerId,
                blocking: true,
                choices: targets.map((t) => t.username),
                data: {
                    targets: targets.map((t) => ({
                        targetPlayerId: t.id,
                        targetUsername: t.username,
                    })),
                },
            };
            meta = {
                ...meta,
                pendingContext: {
                    kind: 'pair_advance',
                    actorId: playerId,
                    replayAfter,
                },
            };
            return {
                ...next,
                pending,
                metadata: { ...(next.metadata ?? {}), ...meta },
            };
        }
        if (/aidez un autre joueur en le faisant avancer de 2 cases/i.test(text)) {
            const targets = this.otherPlayers(next, playerId);
            const pending = {
                type: 'choose_target',
                label: 'Choisissez un joueur dans la liste, puis Entr�e.',
                playerId,
                blocking: true,
                choices: targets.map((t) => t.username),
                data: {
                    targets: targets.map((t) => ({
                        targetPlayerId: t.id,
                        targetUsername: t.username,
                    })),
                },
            };
            meta = {
                ...meta,
                pendingContext: {
                    kind: 'help_advance',
                    actorId: playerId,
                    replayAfter,
                },
            };
            return {
                ...next,
                pending,
                metadata: { ...(next.metadata ?? {}), ...meta },
            };
        }
        if (/D�faussez-vous d''une pomme/i.test(text) ||
            /D�faussez-vous d'une pomme/i.test(text)) {
            const a = meta.apples?.[playerId] ?? 0;
            if (a > 0) {
                meta = { ...meta, apples: { ...meta.apples, [playerId]: a - 1 } };
                return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
            }
            return this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, playerId)} n'a pas de pomme � d�fausser.`);
        }
        if (/jusqu['�]� la prochaine case for�t/i.test(text)) {
            const nextPos = findNext(meta.tiles, meta.positions[playerId] ?? 0, (t) => t.region === 'foret');
            if (nextPos != null) {
                next = this.setPos(next, playerId, nextPos);
                return this.applyLanding(next, playerId);
            }
        }
        if (/jusqu['�]� la prochaine case montagne/i.test(text)) {
            const nextPos = findNext(meta.tiles, meta.positions[playerId] ?? 0, (t) => t.region === 'montagne');
            if (nextPos != null) {
                next = this.setPos(next, playerId, nextPos);
                return this.applyLanding(next, playerId);
            }
        }
        const delta = extractMoveDelta(text);
        if (delta !== 0) {
            next = this.move(next, playerId, delta);
            return this.applyLanding(next, playerId);
        }
        return next;
    }
    finishGame(state) {
        const meta = this.getMeta(state);
        const entries = Object.entries(meta.apples ?? {}).map(([id, a]) => ({
            id: Number(id),
            apples: Number(a),
        }));
        const best = entries
            .filter((e) => Number.isFinite(e.id))
            .sort((a, b) => b.apples - a.apples)[0];
        if (!best)
            return { ...state, status: 'finished' };
        const nextMeta = { ...meta, winnerId: best.id };
        let next = {
            ...state,
            metadata: { ...(state.metadata ?? {}), ...nextMeta },
            status: 'finished',
        };
        next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, best.id)} remporte la partie avec ${best.apples} pomme(s) !`);
        return next;
    }
    move(state, playerId, delta) {
        const meta = this.getMeta(state);
        const pos = meta.positions?.[playerId] ?? 0;
        return this.setPos(state, playerId, clamp(pos + delta, 0, 39));
    }
    setPos(state, playerId, pos) {
        const meta = this.getMeta(state);
        const nextMeta = {
            ...meta,
            positions: { ...(meta.positions ?? {}), [playerId]: clamp(pos, 0, 39) },
        };
        return { ...state, metadata: { ...(state.metadata ?? {}), ...nextMeta } };
    }
    drawCard(meta) {
        const draw = this.deckPolicies.drawFromPile({
            meta,
            pile: Array.isArray(meta.decks?.cards) ? meta.decks.cards : [],
            discard: Array.isArray(meta.decks?.discard) ? meta.decks.discard : [],
            useWholeMetaRng: true,
            discardDrawnCard: true,
        });
        return {
            card: draw.card,
            meta: {
                ...draw.meta,
                decks: {
                    cards: draw.pile,
                    discard: draw.discard,
                },
            },
        };
    }
    findOccupant(meta, me, pos) {
        for (const [id, p] of Object.entries(meta.positions ?? {})) {
            const pid = Number(id);
            if (!Number.isFinite(pid) || pid === me)
                continue;
            if ((p ?? 0) === pos)
                return pid;
        }
        return null;
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
    pawnLabel(state, id) {
        const players = Array.isArray(state.players) ? state.players : [];
        const player = players.find((x) => x?.id === id) ?? null;
        const pawn = typeof player?.pawn === 'string' ? String(player.pawn).trim() : '';
        if (!pawn)
            return '"son pion"';
        const lower = pawn.toLowerCase();
        const feminine = lower.startsWith('la ') || lower.startsWith('une ');
        const inner = pawn
            .replace(/^l['�]\s*/i, '')
            .replace(/^(le|la|les|un|une)\s+/i, '')
            .trim();
        const core = inner || pawn;
        const lowered = core.length <= 1
            ? core.toLowerCase()
            : `${core.charAt(0).toLowerCase()}${core.slice(1)}`;
        return `"${feminine ? 'sa' : 'son'} ${lowered}"`;
    }
};
exports.GaloponsActionService = GaloponsActionService;
exports.GaloponsActionService = GaloponsActionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [random_service_1.RandomService,
        turn_flow_service_1.TurnFlowService,
        game_core_service_1.GameCoreService,
        deck_policies_service_1.DeckPoliciesService])
], GaloponsActionService);
function clamp(value, min, max) {
    if (value < min)
        return min;
    if (value > max)
        return max;
    return value;
}
function extractMoveDelta(text) {
    const numWords = {
        un: 1,
        une: 1,
        deux: 2,
        trois: 3,
        quatre: 4,
        cinq: 5,
        six: 6,
    };
    const parseNumberish = (raw) => {
        const n = Number(raw);
        if (Number.isFinite(n) && n !== 0)
            return n;
        const key = raw.trim().toLowerCase();
        return numWords[key] ?? 0;
    };
    const forwardApos = text.match(/Avancez\s+d['�]\s*(\d+)\s+case/i);
    if (forwardApos)
        return Number(forwardApos[1]) || 0;
    const forwardOneApos = text.match(/Avancez\s+d['�]\s*(un|une)\s+case/i);
    if (forwardOneApos)
        return 1;
    const forward = text.match(/Avancez\s+de\s+(\d+)\s+case/i);
    if (forward)
        return Number(forward[1]) || 0;
    const forwardWords = text.match(/Avancez\s+de\s+(un|une|deux|trois|quatre|cinq|six)\s+case/i);
    if (forwardWords)
        return parseNumberish(forwardWords[1]);
    const backApos = text.match(/Reculez\s+d['�]\s*(\d+)\s+case/i);
    if (backApos)
        return -(Number(backApos[1]) || 0);
    const backOneApos = text.match(/Reculez\s+d['�]\s*(un|une)\s+case/i);
    if (backOneApos)
        return -1;
    const back = text.match(/Reculez\s+de\s+(\d+)\s+case/i);
    if (back)
        return -(Number(back[1]) || 0);
    const backWords = text.match(/Reculez\s+de\s+(un|une|deux|trois|quatre|cinq|six)\s+case/i);
    if (backWords)
        return -parseNumberish(backWords[1]);
    return 0;
}
function findNext(tiles, start, predicate) {
    for (let i = start + 1; i < tiles.length; i += 1) {
        if (predicate(tiles[i]))
            return i;
    }
    return null;
}
//# sourceMappingURL=galopons-action.service.js.map