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
exports.FrousseActionService = void 0;
const common_1 = require("@nestjs/common");
const action_service_helper_1 = require("../../../../actions/action-service.helper");
const player_name_helper_1 = require("../../../../modules/turn-policies/player-name.helper");
const game_core_service_1 = require("../../../../core/services/game-core.service");
const random_service_1 = require("../../../../modules/random/services/random.service");
const setup_flow_service_1 = require("../../../../modules/setup-flow/services/setup-flow.service");
const board_effects_policies_service_1 = require("../../../../modules/board-effects-policies/services/board-effects-policies.service");
const deck_policies_service_1 = require("../../../../modules/deck-policies/services/deck-policies.service");
const turn_flow_service_1 = require("../../../../modules/turn/services/turn-flow.service");
const pawn_choice_action_helper_1 = require("../../../../core/helpers/pawn-choice-action.helper");
const pawns_utils_1 = require("../pawns.utils");
let FrousseActionService = class FrousseActionService {
    random;
    turns;
    core;
    setupFlow;
    boardEffects;
    deckPolicies;
    constructor(random, turns, core, setupFlow, boardEffects, deckPolicies) {
        this.random = random;
        this.turns = turns;
        this.core = core;
        this.setupFlow = setupFlow;
        this.boardEffects = boardEffects;
        this.deckPolicies = deckPolicies;
    }
    advanceTurnWithAnnouncement(state) {
        return this.turns.advanceTurn(state);
    }
    applyActions(state, actions) {
        const next = (0, action_service_helper_1.applyActionsSequentially)(this.ensurePawnSelection(state), actions, (next, action) => {
            const type = (0, action_service_helper_1.normalizeActionType)(action);
            return (0, action_service_helper_1.dispatchByActionType)(type, {
                choose_pawn: () => {
                    next = this.handleChoosePawn(next, action);
                    next = this.ensurePawnSelection(next);
                    return next;
                },
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
    handleChoosePawn(state, action) {
        const resolved = (0, pawn_choice_action_helper_1.resolvePendingPawnChoiceAction)({
            state,
            action,
            pendingType: 'choose_pawn',
            resolveChoice: (rawPawn, options) => this.setupFlow.resolvePawnChoice(rawPawn, options),
        });
        if (!resolved)
            return state;
        const { playerId, chosen } = resolved;
        const players = (state.players ?? []).map((p) => {
            if (p?.id !== playerId)
                return p;
            return {
                ...p,
                pawn: chosen.id,
                pawnLabel: String(chosen.label ?? chosen.id ?? ''),
            };
        });
        const next = {
            ...state,
            players,
            pending: null,
        };
        const label = chosen.label ?? chosen.id ?? 'pion';
        const withLog = this.core.appendLog(next, `[Frousse Party] ${(0, player_name_helper_1.resolvePlayerNameFromState)(next, playerId)} choisit le pion: ${label}.`);
        return this.finalizeStarterAfterPawnSelection(withLog);
    }
    ensurePawnSelection(state) {
        if (state.pending)
            return state;
        const players = Array.isArray(state.players) ? state.players : [];
        const metaForPending = this.getMeta(state);
        const usedForPending = new Set(players
            .map((p) => (0, pawns_utils_1.resolvePawnId)(p?.pawn))
            .filter((id) => Boolean(id)));
        const choicesForPending = (Array.isArray(metaForPending.pawns) ? metaForPending.pawns : [])
            .map((p) => ({
            id: toText(p?.id),
            label: toText(p?.name) || toText(p?.id),
            description: toText(p?.description),
        }))
            .filter((p) => p.id.length > 0 && !usedForPending.has(p.id));
        const pendingInfo = this.setupFlow.createSequentialPawnPending({
            players,
            startPlayerId: players[0]?.id ?? null,
            isAssigned: (candidateId) => {
                const player = players.find((p) => p?.id === candidateId);
                return Boolean((0, pawns_utils_1.resolvePawnId)(player?.pawn));
            },
            pawns: choicesForPending,
            pawnDataMapper: (choice) => ({
                id: toText(choice.id),
                label: toText(choice.label),
                description: toText(choice.description),
            }),
            extraPendingData: { kind: 'choose_pawn' },
        });
        if (!pendingInfo)
            return state;
        const withPending = {
            ...state,
            pending: pendingInfo.pending,
            turnIndex: pendingInfo.turnIndex,
            turn: {
                ...(state.turn ?? {
                    currentPlayerId: pendingInfo.playerId,
                    direction: 1,
                }),
                currentPlayerId: pendingInfo.playerId,
                direction: state.turn?.direction === -1 ? -1 : 1,
            },
        };
        const chooserId = typeof pendingInfo.playerId === 'number' ? pendingInfo.playerId : null;
        if (chooserId == null) {
            return withPending;
        }
        return withPending;
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
        const skipNow = meta.statuses?.skipTurn?.[currentId] ?? 0;
        if (skipNow > 0) {
            meta = {
                ...meta,
                statuses: {
                    ...meta.statuses,
                    skipTurn: {
                        ...(meta.statuses?.skipTurn ?? {}),
                        [currentId]: Math.max(0, skipNow - 1),
                    },
                },
            };
            let next = {
                ...state,
                metadata: { ...(state.metadata ?? {}), ...meta },
            };
            const remaining = Math.max(0, skipNow - 1);
            const suffix = remaining > 0 ? ` (${remaining} restant)` : '';
            next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, currentId)} passe son tour${suffix}.`);
            return this.advanceTurnWithAnnouncement(next);
        }
        const blocked = meta.statuses?.blocked?.[currentId] ?? null;
        if (blocked) {
            const roll = this.roll(meta, currentId);
            meta = roll.meta;
            let next = {
                ...state,
                metadata: { ...(state.metadata ?? {}), ...meta },
                lastRoll: roll.value,
            };
            const rollLabel = this.formatRollLabel(roll);
            next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, currentId)} tente de se libÃ©rer : dÃ© = "${rollLabel}".`);
            const ok = blocked.kind === 'need_roll_one_of'
                ? blocked.allowed.includes(roll.value)
                : blocked.kind === 'need_roll_min'
                    ? roll.value >= blocked.min
                    : blocked.kind === 'need_roll_even'
                        ? roll.value % 2 === 0
                        : false;
            if (!ok) {
                next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, currentId)} reste bloquÃ©.`);
                return this.advanceTurnWithAnnouncement(next);
            }
            meta = this.getMeta(next);
            meta = {
                ...meta,
                statuses: {
                    ...meta.statuses,
                    blocked: { ...(meta.statuses.blocked ?? {}), [currentId]: null },
                },
            };
            next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
            next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, currentId)} se libÃ¨re !`);
            return this.advanceTurnWithAnnouncement(next);
        }
        const roll = this.roll(meta, currentId);
        meta = roll.meta;
        let move = roll.value;
        const cap = meta.statuses?.nextMoveCap?.[currentId] ?? 0;
        if (cap > 0) {
            move = Math.min(move, cap);
            meta = {
                ...meta,
                statuses: {
                    ...meta.statuses,
                    nextMoveCap: { ...(meta.statuses.nextMoveCap ?? {}), [currentId]: 0 },
                },
            };
        }
        let next = {
            ...state,
            metadata: { ...(state.metadata ?? {}), ...meta },
            lastRoll: roll.value,
        };
        if (roll.rolls && roll.rolls.length >= 2) {
            next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, currentId)} lance deux dÃ©s : "${roll.rolls[0]}" et "${roll.rolls[1]}" (garde "${roll.value}").`);
        }
        else {
            const rollLabel = this.formatRollLabel(roll);
            next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, currentId)} lance le dÃ© : "${rollLabel}".`);
        }
        if (meta.statuses?.nextRollIfThreeBackTwo?.[currentId] === true) {
            meta = {
                ...meta,
                statuses: {
                    ...meta.statuses,
                    nextRollIfThreeBackTwo: {
                        ...(meta.statuses.nextRollIfThreeBackTwo ?? {}),
                        [currentId]: false,
                    },
                },
            };
            next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
            if (roll.value === 3) {
                next = this.core.appendLog(next, 'Reculez de 2 cases.');
                next = this.move(next, currentId, -2);
            }
            meta = this.getMeta(next);
        }
        next = this.move(next, currentId, move);
        next = this.applyLanding(next, currentId);
        meta = this.getMeta(next);
        if (meta.winnerId != null)
            return { ...next, status: 'finished' };
        if (next.pending)
            return next;
        if (meta.keepTurnNow === true) {
            delete meta.keepTurnNow;
            next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
            return this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, currentId)} rejoue.`);
        }
        return this.advanceTurnWithAnnouncement(next);
    }
    handleChooseTarget(state, action) {
        if (String(state.status ?? '').toLowerCase() !== 'started')
            return state;
        const currentId = state.turn?.currentPlayerId ?? null;
        if (currentId == null)
            return state;
        const pending = asPendingRecord(state.pending);
        if (!pending ||
            pending.type !== 'choose_target' ||
            pending.playerId !== currentId)
            return state;
        const targetPlayerId = Number(asRecord(action.payload).targetPlayerId);
        if (!Number.isFinite(targetPlayerId))
            return state;
        let meta = this.getMeta(state);
        const ctx = meta.pendingContext ?? null;
        if (!ctx || ctx.kind !== 'swap' || ctx.actorId !== currentId)
            return { ...state, pending: null };
        const actorPos = meta.positions?.[currentId] ?? 0;
        const targetPos = meta.positions?.[targetPlayerId] ?? 0;
        meta = {
            ...meta,
            positions: {
                ...(meta.positions ?? {}),
                [currentId]: targetPos,
                [targetPlayerId]: actorPos,
            },
            pendingContext: null,
        };
        let next = {
            ...state,
            pending: null,
            metadata: { ...(state.metadata ?? {}), ...meta },
        };
        next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, currentId)} Ã©change sa position avec ${(0, player_name_helper_1.resolvePlayerNameFromState)(next, targetPlayerId)}.`);
        return this.advanceTurnWithAnnouncement(next);
    }
    handleDraw(state) {
        if (String(state.status ?? '').toLowerCase() !== 'started')
            return state;
        const pending = asPendingRecord(state.pending);
        if (!pending || pending.type !== 'draw')
            return state;
        const playerId = typeof pending.playerId === 'number'
            ? pending.playerId
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
        if (tile) {
            const labelRaw = toText(asRecord(tile).label);
            const typeLabel = tile.type === 'card' ? 'case symbole' : 'case neutre';
            const fallbackLabel = `case ${tile.n}. ${tile.title} (${typeLabel})`;
            const label = labelRaw || fallbackLabel;
            const casePrefix = new RegExp(`^case\\s+${tile.n}\\b[\\s.:,;-]*`, 'i');
            const normalizedLabel = label.replace(casePrefix, '').trim();
            const labelForParenthesis = normalizedLabel || label;
            const placement = this.boardEffects.createPlacementLog({
                playerLabel: (0, player_name_helper_1.resolvePlayerNameFromState)(next, playerId),
                pawnLabel: this.pawnPossessiveLabel(next, playerId),
                position: Math.max(0, Number(tile.n ?? pos + 1) - 1),
                tileLabel: labelForParenthesis,
            });
            next = this.core.appendLog(next, placement);
            const landing = this.boardEffects.resolveLanding({
                position: pos,
                playerId,
                tile: {
                    type: tile.type,
                    description: toText(asRecord(tile).description),
                },
                drawPolicies: {
                    card: {
                        log: 'Piochez une carte.',
                        pendingLabel: 'Piocher une carte (Espace).',
                    },
                },
            });
            for (const line of landing.logs) {
                if (line.trim().length > 0) {
                    next = this.core.appendLog(next, line);
                }
            }
        }
        if (pos >= 49) {
            meta = { ...meta, winnerId: playerId };
            next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, playerId)} s'Ã©chappe du manoir !`);
            return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
        }
        if (!tile)
            return next;
        if (tile.type !== 'card')
            return next;
        const pending = this.boardEffects.resolveLanding({
            position: pos,
            playerId,
            tile: {
                type: tile.type,
                description: null,
            },
            drawPolicies: {
                card: {
                    log: 'Piochez une carte.',
                    pendingLabel: 'Piocher une carte (Espace).',
                },
            },
        }).pending;
        if (!pending)
            return next;
        return { ...next, pending };
    }
    applyDrawCard(state, playerId) {
        let next = state;
        let meta = this.getMeta(next);
        const draw = this.drawCard(meta);
        meta = draw.meta;
        next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
        if (!draw.card)
            return next;
        let ignored = false;
        if (meta.statuses.ignoreTrapUntilNextDraw?.[playerId]) {
            meta = {
                ...meta,
                statuses: {
                    ...meta.statuses,
                    ignoreTrapUntilNextDraw: {
                        ...(meta.statuses.ignoreTrapUntilNextDraw ?? {}),
                        [playerId]: false,
                    },
                },
            };
            next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
            if (/PiÃ¨ge/i.test(draw.card.category)) {
                ignored = true;
            }
        }
        if (/FantÃ´me/i.test(draw.card.category) &&
            meta.statuses.ignoreNextGhost?.[playerId]) {
            meta = {
                ...meta,
                statuses: {
                    ...meta.statuses,
                    ignoreNextGhost: {
                        ...(meta.statuses.ignoreNextGhost ?? {}),
                        [playerId]: false,
                    },
                },
            };
            next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
            ignored = true;
        }
        if (/Farce/i.test(draw.card.category) &&
            meta.statuses.ignoreNextPrank?.[playerId]) {
            meta = {
                ...meta,
                statuses: {
                    ...meta.statuses,
                    ignoreNextPrank: {
                        ...(meta.statuses.ignoreNextPrank ?? {}),
                        [playerId]: false,
                    },
                },
            };
            next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
            ignored = true;
        }
        if (/PiÃ¨ge/i.test(draw.card.category) &&
            meta.statuses.ignoreNextTrap?.[playerId]) {
            meta = {
                ...meta,
                statuses: {
                    ...meta.statuses,
                    ignoreNextTrap: {
                        ...(meta.statuses.ignoreNextTrap ?? {}),
                        [playerId]: false,
                    },
                },
            };
            next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
            ignored = true;
        }
        const effectLabel = ignored
            ? 'Effet ignorÃ©.'
            : describeCardEffect(draw.card);
        const cardText = normalizeCardText(draw.card.text);
        const withEffect = formatCardDrawLog((0, player_name_helper_1.resolvePlayerNameFromState)(next, playerId), cardText, effectLabel);
        next = this.core.appendLog(next, withEffect);
        if (ignored) {
            return this.advanceTurnWithAnnouncement(next);
        }
        const applied = this.applyCard(next, playerId, draw.card);
        const appliedMeta = this.getMeta(applied);
        if (applied.pending)
            return applied;
        if (appliedMeta.keepTurnNow === true) {
            delete appliedMeta.keepTurnNow;
            return {
                ...applied,
                metadata: { ...(applied.metadata ?? {}), ...appliedMeta },
            };
        }
        return this.advanceTurnWithAnnouncement(applied);
    }
    applyCard(state, playerId, card) {
        let next = state;
        let meta = this.getMeta(next);
        const text = card.text;
        if (/Bonus/i.test(card.category) && card.localNumber === 13) {
            next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, playerId)} saute 6 cases.`);
            next = this.move(next, playerId, 6);
            return this.applyLanding(next, playerId);
        }
        if (/FantÃ´me/i.test(card.category) &&
            /fantÃ´me farceur/i.test(text) &&
            /Ã©chang|Ã©change/i.test(text)) {
            const targets = this.otherPlayers(next, playerId);
            if (!targets.length)
                return next;
            const pick = this.random.pickOne(meta, targets);
            meta = pick.meta;
            const target = pick.value;
            if (!target)
                return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
            const actorPos = meta.positions?.[playerId] ?? 0;
            const targetPos = meta.positions?.[target.id] ?? 0;
            meta = {
                ...meta,
                positions: {
                    ...(meta.positions ?? {}),
                    [playerId]: targetPos,
                    [target.id]: actorPos,
                },
            };
            next = this.core.appendLog({ ...next, metadata: { ...(next.metadata ?? {}), ...meta } }, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, playerId)} Ã©change sa position avec ${(0, player_name_helper_1.resolvePlayerNameFromState)(next, target.id)}.`);
            return next;
        }
        if (/Ã©chang|echange/i.test(text) &&
            (/votre place/i.test(text) || /vos places/i.test(text))) {
            const targets = this.otherPlayers(next, playerId);
            if (!targets.length)
                return next;
            const pending = {
                type: 'choose_target',
                label: 'Choisissez un joueur dans la liste, puis EntrÃ©e.',
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
            meta = { ...meta, pendingContext: { kind: 'swap', actorId: playerId } };
            return {
                ...next,
                pending,
                metadata: { ...(next.metadata ?? {}), ...meta },
            };
        }
        if (/Ignorez les piÃ¨ges jusqu['â€™]au prochain symbole/i.test(text)) {
            meta = {
                ...meta,
                statuses: {
                    ...meta.statuses,
                    ignoreTrapUntilNextDraw: {
                        ...(meta.statuses.ignoreTrapUntilNextDraw ?? {}),
                        [playerId]: true,
                    },
                },
            };
            return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
        }
        if (/Ignorez le prochain piÃ¨ge/i.test(text) ||
            /Ignorez les piÃ¨ges/i.test(text)) {
            meta = {
                ...meta,
                statuses: {
                    ...meta.statuses,
                    ignoreNextTrap: {
                        ...(meta.statuses.ignoreNextTrap ?? {}),
                        [playerId]: true,
                    },
                },
            };
            return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
        }
        if (/Ignorez la prochaine carte FantÃ´me/i.test(text)) {
            meta = {
                ...meta,
                statuses: {
                    ...meta.statuses,
                    ignoreNextGhost: {
                        ...(meta.statuses.ignoreNextGhost ?? {}),
                        [playerId]: true,
                    },
                },
            };
            return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
        }
        if (/annule une farce/i.test(text) || /rien ne vous arrive/i.test(text)) {
            meta = {
                ...meta,
                statuses: {
                    ...meta.statuses,
                    ignoreNextPrank: {
                        ...(meta.statuses.ignoreNextPrank ?? {}),
                        [playerId]: true,
                    },
                },
            };
            next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
            return this.core.appendLog(next, 'Protection farce activÃ©e.');
        }
        if (/Sautez\s+6\s+cases/i.test(text)) {
            next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, playerId)} saute 6 cases.`);
            next = this.move(next, playerId, 6);
            return this.applyLanding(next, playerId);
        }
        const need56 = text.match(/lancer un (\d) ou un (\d)/i);
        if (need56) {
            const a = Number(need56[1]);
            const b = Number(need56[2]);
            meta = {
                ...meta,
                statuses: {
                    ...meta.statuses,
                    blocked: {
                        ...(meta.statuses.blocked ?? {}),
                        [playerId]: { kind: 'need_roll_one_of', allowed: [a, b] },
                    },
                },
            };
            return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
        }
        const need6 = text.match(/obtenir un 6/i);
        if (need6 && /jusqu/i.test(text)) {
            meta = {
                ...meta,
                statuses: {
                    ...meta.statuses,
                    blocked: {
                        ...(meta.statuses.blocked ?? {}),
                        [playerId]: { kind: 'need_roll_one_of', allowed: [6] },
                    },
                },
            };
            return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
        }
        const needMin = text.match(/obtenez pas un (\d) ou plus/i);
        if (needMin) {
            meta = {
                ...meta,
                statuses: {
                    ...meta.statuses,
                    blocked: {
                        ...(meta.statuses.blocked ?? {}),
                        [playerId]: { kind: 'need_roll_min', min: Number(needMin[1]) },
                    },
                },
            };
            return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
        }
        if (/nombre pair/i.test(text)) {
            meta = {
                ...meta,
                statuses: {
                    ...meta.statuses,
                    blocked: {
                        ...(meta.statuses.blocked ?? {}),
                        [playerId]: { kind: 'need_roll_even' },
                    },
                },
            };
            return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
        }
        if (/n['â€™]avancerez que d['â€™](une|un)e seule case/i.test(text)) {
            meta = {
                ...meta,
                statuses: {
                    ...meta.statuses,
                    nextMoveCap: { ...(meta.statuses.nextMoveCap ?? {}), [playerId]: 1 },
                },
            };
            return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
        }
        if (/malus de moins 2/i.test(text) || /malus de -2/i.test(text)) {
            meta = {
                ...meta,
                statuses: {
                    ...meta.statuses,
                    nextRollMalus: {
                        ...(meta.statuses.nextRollMalus ?? {}),
                        [playerId]: -2,
                    },
                },
            };
            meta.keepTurnNow = true;
            return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
        }
        if (/gardez le plus petit/i.test(text) ||
            /gardez le chiffre le plus bas/i.test(text)) {
            meta = {
                ...meta,
                statuses: {
                    ...meta.statuses,
                    nextRollKeepLowest: {
                        ...(meta.statuses.nextRollKeepLowest ?? {}),
                        [playerId]: true,
                    },
                },
            };
            meta.keepTurnNow = true;
            return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
        }
        if (/Doublez votre prochain lancer/i.test(text)) {
            meta = {
                ...meta,
                statuses: {
                    ...meta.statuses,
                    nextRollDouble: {
                        ...(meta.statuses.nextRollDouble ?? {}),
                        [playerId]: true,
                    },
                },
            };
            return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
        }
        if (/Si vous faites un trois, reculez de 2 cases/i.test(text)) {
            meta = {
                ...meta,
                statuses: {
                    ...meta.statuses,
                    nextRollIfThreeBackTwo: {
                        ...(meta.statuses.nextRollIfThreeBackTwo ?? {}),
                        [playerId]: true,
                    },
                },
            };
            meta.keepTurnNow = true;
            return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
        }
        if (/jusqu'a la case 40/i.test(text) ||
            /jusqu['’]a la case 40/i.test(text)) {
            next = this.setPos(next, playerId, 39);
            return this.applyLanding(next, playerId);
        }
        if (/Relancez le dÃ©/i.test(text) ||
            (/Relancez/i.test(text) && /dÃ©/i.test(text))) {
            meta.keepTurnNow = true;
            return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
        }
        if (/laissant les autres joueurs (filer|avancer) de 3 cases/i.test(text)) {
            const others = this.otherPlayerIds(meta, playerId);
            for (const pid of others) {
                meta.positions[pid] = clamp((meta.positions[pid] ?? 0) + 3, 0, 49);
            }
            const curr = meta.statuses.skipTurn?.[playerId] ?? 0;
            meta = {
                ...meta,
                statuses: {
                    ...meta.statuses,
                    skipTurn: { ...(meta.statuses.skipTurn ?? {}), [playerId]: curr + 1 },
                },
            };
            return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
        }
        if (/si le rÃ©sultat est impair, passez (?:votre|un|une|1)?\s*tour/i.test(text)) {
            const out = this.random.rollDice(meta, 6);
            meta = { ...meta, ...out.meta };
            next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
            next = this.core.appendLog(next, `Test : dÃ© = "${out.roll}".`);
            if (out.roll % 2 === 1) {
                const curr = meta.statuses.skipTurn?.[playerId] ?? 0;
                meta = {
                    ...meta,
                    statuses: {
                        ...meta.statuses,
                        skipTurn: {
                            ...(meta.statuses.skipTurn ?? {}),
                            [playerId]: curr + 1,
                        },
                    },
                };
                return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
            }
            return next;
        }
        const skip = extractSkipTurns(text);
        if (skip > 0) {
            const curr = meta.statuses.skipTurn?.[playerId] ?? 0;
            meta = {
                ...meta,
                statuses: {
                    ...meta.statuses,
                    skipTurn: {
                        ...(meta.statuses.skipTurn ?? {}),
                        [playerId]: curr + skip,
                    },
                },
            };
            return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
        }
        if (/case dÃ©part/i.test(text) ||
            /Retour a la case une/i.test(text) ||
            (/Retournez/i.test(text) && /case une/i.test(text))) {
            next = this.setPos(next, playerId, 0);
            return this.applyLanding(next, playerId);
        }
        if (/Allez en cuisine/i.test(text)) {
            next = this.setPos(next, playerId, 19);
            return this.applyLanding(next, playerId);
        }
        const delta = extractMoveDelta(text);
        if (delta !== 0) {
            next = this.move(next, playerId, delta);
            return this.applyLanding(next, playerId);
        }
        return next;
    }
    roll(meta, playerId) {
        let outMeta = meta;
        const keepLowest = outMeta.statuses.nextRollKeepLowest?.[playerId] === true;
        if (keepLowest) {
            const a = this.random.rollDice(outMeta, 6);
            outMeta = { ...outMeta, ...a.meta };
            const b = this.random.rollDice(outMeta, 6);
            outMeta = { ...outMeta, ...b.meta };
            const rolls = [a.roll, b.roll];
            outMeta = {
                ...outMeta,
                statuses: {
                    ...outMeta.statuses,
                    nextRollKeepLowest: {
                        ...(outMeta.statuses.nextRollKeepLowest ?? {}),
                        [playerId]: false,
                    },
                },
            };
            const kept = Math.min(a.roll, b.roll);
            return {
                value: kept,
                meta: outMeta,
                rolls,
                baseRoll: kept,
                malusApplied: 0,
                valueAfterMalus: kept,
            };
        }
        const single = this.random.rollDice(outMeta, 6);
        outMeta = { ...outMeta, ...single.meta };
        const baseRoll = single.roll;
        let value = baseRoll;
        const malus = outMeta.statuses.nextRollMalus?.[playerId] ?? 0;
        let malusApplied = 0;
        if (malus !== 0) {
            malusApplied = malus;
            value = clamp(value + malus, 1, 6);
            outMeta = {
                ...outMeta,
                statuses: {
                    ...outMeta.statuses,
                    nextRollMalus: {
                        ...(outMeta.statuses.nextRollMalus ?? {}),
                        [playerId]: 0,
                    },
                },
            };
        }
        const valueAfterMalus = value;
        if (outMeta.statuses.nextRollDouble?.[playerId]) {
            const doubledFrom = value;
            value = value * 2;
            outMeta = {
                ...outMeta,
                statuses: {
                    ...outMeta.statuses,
                    nextRollDouble: {
                        ...(outMeta.statuses.nextRollDouble ?? {}),
                        [playerId]: false,
                    },
                },
            };
            return {
                value,
                meta: outMeta,
                doubledFrom,
                baseRoll,
                malusApplied,
                valueAfterMalus,
            };
        }
        return { value, meta: outMeta, baseRoll, malusApplied, valueAfterMalus };
    }
    formatRollLabel(roll) {
        let label = `${roll.value}`;
        if (roll.malusApplied !== 0) {
            const amount = Math.abs(roll.malusApplied);
            const op = roll.malusApplied < 0 ? 'moins' : 'plus';
            label = `${roll.baseRoll} ${op} ${amount} = ${roll.valueAfterMalus}`;
        }
        if (roll.doubledFrom != null) {
            label = `${label} (doublÃ© = ${roll.value})`;
        }
        return label;
    }
    move(state, playerId, delta) {
        const meta = this.getMeta(state);
        const pos = meta.positions?.[playerId] ?? 0;
        const nextPos = clamp(pos + delta, 0, 49);
        return this.setPos(state, playerId, nextPos);
    }
    setPos(state, playerId, pos) {
        const meta = this.getMeta(state);
        const nextMeta = {
            ...meta,
            positions: { ...(meta.positions ?? {}), [playerId]: clamp(pos, 0, 49) },
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
                decks: { cards: draw.pile, discard: draw.discard },
            },
        };
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
    otherPlayerIds(meta, me) {
        return Object.keys(meta.positions ?? {})
            .map(Number)
            .filter((id) => Number.isFinite(id) && id !== me);
    }
    getMeta(state) {
        return normalizeFrousseMeta(state.metadata);
    }
    pawnLabel(state, id) {
        const players = Array.isArray(state.players) ? state.players : [];
        const player = players.find((p) => p?.id === id);
        const playerRecord = asRecord(player);
        const explicitLabel = toText(playerRecord.pawnLabel);
        if (explicitLabel)
            return `"${explicitLabel}"`;
        const pawnId = toText(playerRecord.pawn);
        const meta = this.getMeta(state);
        const fromMeta = Array.isArray(meta?.pawns)
            ? meta.pawns.find((p) => toText(p?.id) === pawnId)
            : null;
        const name = toText(fromMeta?.name) || pawnId;
        if (name)
            return `"${name}"`;
        return 'un pion';
    }
    pawnPossessiveLabel(state, id) {
        const raw = this.pawnLabel(state, id);
        const inner = String(raw ?? '')
            .trim()
            .replace(/^"(.*)"$/, '$1')
            .trim();
        if (!inner) {
            return '"son pion"';
        }
        const stripped = inner
            .replace(/^(un|une|le|la|les)\s+/i, '')
            .replace(/^l['â€™]\s*/i, '')
            .trim();
        const base = this.lowercaseFirst(stripped || inner);
        const feminine = /^(une|la)\s+/i.test(inner);
        const possessive = feminine ? 'sa' : 'son';
        return `"${possessive} ${base}"`;
    }
    lowercaseFirst(value) {
        const text = String(value ?? '').trim();
        if (!text)
            return text;
        if (text.length === 1)
            return text.toLowerCase();
        return `${text.charAt(0).toLowerCase()}${text.slice(1)}`;
    }
    finalizeStarterAfterPawnSelection(state) {
        if (state.pending)
            return state;
        const players = Array.isArray(state.players) ? state.players : [];
        if (!players.length)
            return state;
        const everyoneHasPawn = players.every((p) => (0, pawns_utils_1.resolvePawnId)(p?.pawn));
        if (!everyoneHasPawn)
            return state;
        const meta = this.getMeta(state);
        if (meta.starterChosenAfterPawnSelection === true) {
            return state;
        }
        const pick = this.random.nextInt(meta, players.length);
        const starterIndex = Math.max(0, Math.min(players.length - 1, pick.value));
        const starter = players[starterIndex] ?? players[0];
        const nextMeta = {
            ...meta,
            ...pick.meta,
            starterChosenAfterPawnSelection: true,
        };
        let next = {
            ...state,
            turnIndex: starterIndex,
            turn: {
                ...(state.turn ?? { direction: 1 }),
                currentPlayerId: starter?.id ?? null,
                direction: 1,
            },
            metadata: { ...(state.metadata ?? {}), ...nextMeta },
        };
        if (typeof starter?.id === 'number') {
            next = this.core.appendLog(next, `[Frousse Party] DÃ©but de partie : ${(0, player_name_helper_1.resolvePlayerNameFromState)(next, starter.id)} commence.`);
            next = this.core.appendLog(next, `C'est au tour de ${(0, player_name_helper_1.resolvePlayerNameFromState)(next, starter.id)}.`);
        }
        return next;
    }
};
exports.FrousseActionService = FrousseActionService;
exports.FrousseActionService = FrousseActionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [random_service_1.RandomService,
        turn_flow_service_1.TurnFlowService,
        game_core_service_1.GameCoreService,
        setup_flow_service_1.SetupFlowService,
        board_effects_policies_service_1.BoardEffectsPoliciesService,
        deck_policies_service_1.DeckPoliciesService])
], FrousseActionService);
function asRecord(value) {
    return value && typeof value === 'object'
        ? value
        : {};
}
function toText(value) {
    if (typeof value === 'string')
        return value.trim();
    if (typeof value === 'number' && Number.isFinite(value))
        return String(value);
    if (typeof value === 'boolean')
        return value ? 'true' : 'false';
    return '';
}
function asPendingRecord(value) {
    if (!value || typeof value !== 'object')
        return null;
    const record = asRecord(value);
    return {
        type: toText(record.type),
        playerId: record.playerId,
    };
}
function normalizeFrousseMeta(input) {
    const raw = asRecord(input);
    const statuses = asRecord(raw.statuses);
    const decks = asRecord(raw.decks);
    return {
        tiles: (Array.isArray(raw.tiles) ? raw.tiles : []),
        positions: asRecord(raw.positions),
        statuses: {
            skipTurn: asRecord(statuses.skipTurn),
            ignoreNextTrap: asRecord(statuses.ignoreNextTrap),
            ignoreTrapUntilNextDraw: asRecord(statuses.ignoreTrapUntilNextDraw),
            ignoreNextPrank: asRecord(statuses.ignoreNextPrank),
            ignoreNextGhost: asRecord(statuses.ignoreNextGhost),
            nextMoveCap: asRecord(statuses.nextMoveCap),
            nextRollMalus: asRecord(statuses.nextRollMalus),
            nextRollKeepLowest: asRecord(statuses.nextRollKeepLowest),
            nextRollDouble: asRecord(statuses.nextRollDouble),
            nextRollIfThreeBackTwo: asRecord(statuses.nextRollIfThreeBackTwo),
            blocked: asRecord(statuses.blocked),
        },
        decks: {
            cards: (Array.isArray(decks.cards) ? decks.cards : []),
            discard: (Array.isArray(decks.discard)
                ? decks.discard
                : []),
        },
        pawns: (Array.isArray(raw.pawns) ? raw.pawns : []),
        pendingContext: asRecord(raw.pendingContext) ??
            null,
        winnerId: typeof raw.winnerId === 'number' ? raw.winnerId : null,
        starterChosenAfterPawnSelection: raw.starterChosenAfterPawnSelection === true,
        keepTurnNow: raw.keepTurnNow === true,
    };
}
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
        if (Number.isFinite(n) && n > 0)
            return n;
        const key = raw.trim().toLowerCase();
        return numWords[key] ?? 0;
    };
    let total = 0;
    const forwardOrBackPattern = /(avancez|reculez)\s+(?:de|d['â€™])\s*(\d+|un|une|deux|trois|quatre|cinq|six)(?:\s+cases?)?/gi;
    let fbMatch;
    while ((fbMatch = forwardOrBackPattern.exec(text)) !== null) {
        const amount = parseNumberish(fbMatch[2]);
        if (amount <= 0)
            continue;
        const verb = String(fbMatch[1] ?? '').toLowerCase();
        total += verb.startsWith('recul') ? -amount : amount;
    }
    const jumpPattern = /sautez\s+(\d+|un|une|deux|trois|quatre|cinq|six)(?:\s+cases?)?/gi;
    let jumpMatch;
    while ((jumpMatch = jumpPattern.exec(text)) !== null) {
        const amount = parseNumberish(jumpMatch[1]);
        if (amount > 0)
            total += amount;
    }
    if (total !== 0)
        return total;
    const narrativeForward = text.match(/avancez[\s\S]*?d['â€™]\s*(\d+|un|une|deux|trois|quatre|cinq|six)\s+case/i);
    if (narrativeForward)
        return parseNumberish(narrativeForward[1]);
    const narrativeBack = text.match(/recul(?:ez|ant|e|es)?[\s\S]*?d['â€™]\s*(\d+|un|une|deux|trois|quatre|cinq|six)\s+case/i);
    if (narrativeBack)
        return -parseNumberish(narrativeBack[1]);
    const forwardApos = text.match(/Avancez\s+d['â€™]\s*(\d+)\s+case/i);
    if (forwardApos)
        return Number(forwardApos[1]) || 0;
    const forwardAposWords = text.match(/Avancez\s+d['â€™]\s*(un|une|deux|trois|quatre|cinq|six)\s+case/i);
    if (forwardAposWords)
        return parseNumberish(forwardAposWords[1]);
    const forward = text.match(/Avancez\s+de\s+(\d+)\s+case/i);
    if (forward)
        return Number(forward[1]) || 0;
    const forwardWords = text.match(/Avancez\s+de\s+(un|une|deux|trois|quatre|cinq|six)\s+case/i);
    if (forwardWords)
        return parseNumberish(forwardWords[1]);
    const backApos = text.match(/Reculez\s+d['â€™]\s*(\d+)\s+case/i);
    if (backApos)
        return -(Number(backApos[1]) || 0);
    const backAposWords = text.match(/Reculez\s+d['â€™]\s*(un|une|deux|trois|quatre|cinq|six)\s+case/i);
    if (backAposWords)
        return -parseNumberish(backAposWords[1]);
    const back = text.match(/Reculez\s+de\s+(\d+)\s+case/i);
    if (back)
        return -(Number(back[1]) || 0);
    const backWords = text.match(/Reculez\s+de\s+(un|une|deux|trois|quatre|cinq|six)\s+case/i);
    if (backWords)
        return -parseNumberish(backWords[1]);
    const jump = text.match(/Sautez\s+(\d+)\s+case/i);
    if (jump)
        return Number(jump[1]) || 0;
    return 0;
}
function extractSkipTurns(text) {
    const numeric = text.match(/Passez\s+(\d+)\s+tours?/i);
    if (numeric) {
        const n = Number(numeric[1]);
        if (Number.isFinite(n) && n > 0)
            return Math.trunc(n);
    }
    const oneWord = text.match(/Passez\s+(un|une)\s+tour/i);
    if (oneWord)
        return 1;
    if (/Passez deux tours/i.test(text))
        return 2;
    if (/Passez trois tours/i.test(text))
        return 3;
    if (/Passez votre tour/i.test(text) || /Passez un tour/i.test(text))
        return 1;
    return 0;
}
function describeCardEffect(card) {
    const text = card.text ?? '';
    if (/FantÃ´me/i.test(card.category) &&
        /fantÃ´me farceur/i.test(text) &&
        /Ã©chang|echange/i.test(text)) {
        return 'Ã‰change alÃ©atoire de place.';
    }
    if (/Ã©chang|echange/i.test(text) &&
        (/votre place/i.test(text) || /vos places/i.test(text))) {
        return 'Ã‰changez votre place avec un autre joueur.';
    }
    if (/Ignorez le prochain piÃ¨ge/i.test(text))
        return 'Ignorez le prochain piÃ¨ge.';
    if (/Ignorez les piÃ¨ges jusqu['â€™]au prochain symbole/i.test(text))
        return 'Ignorez les piÃ¨ges jusquâ€™au prochain symbole.';
    if (/Ignorez la prochaine carte FantÃ´me/i.test(text))
        return 'Ignorez la prochaine carte FantÃ´me.';
    if (/annule une farce/i.test(text) || /rien ne vous arrive/i.test(text))
        return 'Ignorez la prochaine farce.';
    if (/Sautez\s+6\s+cases/i.test(text) ||
        (/Bonus/i.test(card.category) && card.localNumber === 13))
        return 'Sautez 6 cases.';
    if (/Doublez votre prochain lancer/i.test(text))
        return 'Doublez le prochain lancer de dÃ©.';
    if (/gardez le plus petit/i.test(text) ||
        /gardez le chiffre le plus bas/i.test(text))
        return 'Rejouez en gardant le plus petit rÃ©sultat.';
    if (/malus de moins 2/i.test(text) || /malus de -2/i.test(text))
        return 'Rejouez avec un malus de -2 au lancer.';
    if (/Si vous faites un trois, reculez de 2 cases/i.test(text))
        return 'Si vous faites un trois, reculez de 2 cases.';
    if (/jusqu['’]a la case 40/i.test(text))
        return 'Allez directement a la case 40.';
    if (/Relancez le dÃ©/i.test(text) ||
        (/Relancez/i.test(text) && /dÃ©/i.test(text)))
        return 'Rejouez immÃ©diatement.';
    if (/laissant les autres joueurs (filer|avancer) de 3 cases/i.test(text))
        return 'Les autres avancent de 3 cases, vous passez 1 tour.';
    if (/si le rÃ©sultat est impair, passez (?:votre|un|une|1)?\s*tour/i.test(text)) {
        return 'Lancez le dÃ© : si le rÃ©sultat est impair, passez 1 tour.';
    }
    const skip = extractSkipTurns(text);
    if (skip > 0)
        return `Passez ${skip} tour${skip > 1 ? 's' : ''}.`;
    if (/case depart/i.test(text) || /Retour a la case une/i.test(text))
        return 'Retournez a la case depart.';
    if (/Allez en cuisine/i.test(text))
        return 'Allez en cuisine.';
    const combo = text.match(/Avancez\s+de\s+(\d+)\s+cases?,\s+puis\s+reculez\s+de\s+(\d+)\s+cases?/i);
    if (combo)
        return `Avancez de ${combo[1]} cases, puis reculez de ${combo[2]}.`;
    const delta = extractMoveDelta(text);
    if (delta > 0)
        return `Avancez de ${delta} case${delta > 1 ? 's' : ''}.`;
    if (delta < 0)
        return `Reculez de ${Math.abs(delta)} case${Math.abs(delta) > 1 ? 's' : ''}.`;
    const need56 = text.match(/lancer un (\d) ou un (\d)/i);
    if (need56)
        return `BloquÃ© : lancez un ${need56[1]} ou un ${need56[2]} pour vous libÃ©rer.`;
    const need6 = text.match(/obtenir un 6/i);
    if (need6 && /jusqu/i.test(text))
        return 'BloquÃ© : obtenez un 6 pour vous libÃ©rer.';
    const needMin = text.match(/obtenez pas un (\d) ou plus/i);
    if (needMin)
        return `BloquÃ© : obtenez ${needMin[1]} ou plus pour vous libÃ©rer.`;
    if (/nombre pair/i.test(text))
        return 'BloquÃ© : obtenez un nombre pair pour vous libÃ©rer.';
    if (/n['â€™]avancerez que d['â€™](une|un)e seule case/i.test(text))
        return 'Au prochain tour, avancez dâ€™une seule case.';
    return 'Effet immÃ©diat.';
}
function normalizeCardText(text) {
    return String(text ?? '')
        .replace(/\r/g, '')
        .replace(/\n+/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();
}
function formatCardDrawLog(playerName, cardText, effectLabel) {
    const base = `${playerName} pioche une carte (${cardText})`;
    if (shouldSuppressRepeatedEffect(cardText, effectLabel)) {
        return `${base}.`;
    }
    return `${base} : ${effectLabel}`;
}
function shouldSuppressRepeatedEffect(cardText, effectLabel) {
    const effect = normalizeForContains(effectLabel);
    if (!effect)
        return false;
    const card = normalizeForContains(cardText);
    if (!card)
        return false;
    return card.includes(effect);
}
function normalizeForContains(value) {
    return String(value ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
//# sourceMappingURL=frousse-action.service.js.map