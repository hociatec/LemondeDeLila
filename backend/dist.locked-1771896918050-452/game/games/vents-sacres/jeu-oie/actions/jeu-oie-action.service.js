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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JeuOieActionService = void 0;
const common_1 = require("@nestjs/common");
const player_name_helper_1 = require("../../../../modules/turn-policies/player-name.helper");
const random_service_1 = require("../../../../modules/random/services/random.service");
const turn_flow_service_1 = require("../../../../modules/turn/services/turn-flow.service");
const game_core_service_1 = require("../../../../core/services/game-core.service");
const setup_flow_service_1 = require("../../../../modules/setup-flow/services/setup-flow.service");
const turn_policies_service_1 = require("../../../../modules/turn-policies/services/turn-policies.service");
const pawn_choice_action_helper_1 = require("../../../../core/helpers/pawn-choice-action.helper");
const action_service_helper_1 = require("../../../../actions/action-service.helper");
let JeuOieActionService = class JeuOieActionService {
    random;
    turns;
    core;
    setupFlow;
    turnPolicies;
    constructor(random, turns, core, setupFlow, turnPolicies) {
        this.random = random;
        this.turns = turns;
        this.core = core;
        this.setupFlow = setupFlow;
        this.turnPolicies = turnPolicies;
    }
    applyActions(state, actions) {
        const next = (0, action_service_helper_1.applyActionsSequentially)(this.ensurePawnSelectionPrompt(state), actions, (current, action) => {
            const type = (0, action_service_helper_1.normalizeActionType)(action);
            return (0, action_service_helper_1.dispatchByActionType)(type, {
                choose_pawn: () => this.ensurePawnSelectionPrompt(this.handleChoosePawn(current, action)),
                roll: () => this.handleRoll(current),
            }, () => current);
        });
        return this.ensurePawnSelectionPrompt(next);
    }
    handleChoosePawn(state, action) {
        if (String(state.status ?? '').toLowerCase() !== 'started')
            return state;
        const resolved = (0, pawn_choice_action_helper_1.resolvePendingPawnChoiceAction)({
            state,
            action,
            pendingType: 'choose_pawn',
            resolveChoice: (rawPawn, options) => this.setupFlow.resolvePawnChoice(rawPawn, options),
        });
        if (!resolved)
            return state;
        const { playerId, options, chosen } = resolved;
        const meta = this.getMeta(state);
        const assigned = { ...(meta.pawnByPlayerId ?? {}) };
        if (assigned[playerId])
            return state;
        if (Object.values(assigned).some((id) => id === chosen.id))
            return state;
        const nextMeta = {
            ...meta,
            pawns: Array.isArray(meta.pawns) && meta.pawns.length > 0
                ? meta.pawns
                : options.map((p) => ({
                    id: String(p?.id ?? '').trim(),
                    label: String(p?.label ?? '').trim(),
                    feminine: Boolean(p?.feminine),
                })),
            pawnByPlayerId: { ...assigned, [playerId]: chosen.id },
        };
        let next = {
            ...state,
            pending: null,
            metadata: { ...(state.metadata ?? {}), ...nextMeta },
        };
        next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, playerId)} choisit le pion : ${String(chosen.label ?? 'pion').trim()}.`);
        const playersForPending = Array.isArray(next.players) ? next.players : [];
        const metaForPending = this.getMeta(next);
        const pawnByPlayerIdForPending = metaForPending.pawnByPlayerId ?? {};
        const allPawnsForPending = Array.isArray(metaForPending.pawns)
            ? metaForPending.pawns
            : [];
        const usedForPending = new Set(Object.values(pawnByPlayerIdForPending).filter((v) => typeof v === 'string'));
        const choicesForPending = allPawnsForPending
            .map((p) => ({
            id: String(p?.id ?? '').trim(),
            label: String(p?.label ?? '').trim(),
            feminine: Boolean(p?.feminine),
        }))
            .filter((p) => p.id.length > 0 && !usedForPending.has(p.id));
        const pendingInfo = this.setupFlow.createSequentialPawnPending({
            players: playersForPending,
            startPlayerId: playerId,
            isAssigned: (candidateId) => Boolean(pawnByPlayerIdForPending[candidateId]),
            pawns: choicesForPending,
            pawnDataMapper: (p) => ({
                id: String(p?.id ?? '').trim(),
                label: String(p?.label ?? '').trim(),
                feminine: Boolean(p?.feminine),
            }),
        });
        if (pendingInfo) {
            const withPending = {
                ...next,
                pending: pendingInfo.pending,
                turnIndex: pendingInfo.turnIndex,
                turn: {
                    ...(next.turn ?? { direction: 1 }),
                    currentPlayerId: pendingInfo.playerId,
                    direction: 1,
                },
            };
            return this.ensurePawnSelectionPrompt(withPending);
        }
        const players = Array.isArray(next.players) ? next.players : [];
        const starterId = typeof nextMeta.setupStarterId === 'number'
            ? nextMeta.setupStarterId
            : (players[0]?.id ?? null);
        const starterIndex = starterId != null ? players.findIndex((p) => p?.id === starterId) : -1;
        const resolvedStarterId = starterId != null && starterIndex >= 0
            ? starterId
            : (players[0]?.id ?? null);
        let started = {
            ...next,
            pending: null,
            turnIndex: starterIndex >= 0 ? starterIndex : next.turnIndex,
            turn: {
                ...(next.turn ?? { direction: 1 }),
                currentPlayerId: resolvedStarterId,
                direction: 1,
            },
        };
        const starterName = (0, player_name_helper_1.resolvePlayerNameFromState)(started, resolvedStarterId ?? 0);
        started = this.core.appendLog(started, `D\u00e9but de partie : ${starterName} commence.`);
        return this.getTurnPolicies().appendTurnAnnouncement(started, resolvedStarterId, (s, id) => (0, player_name_helper_1.resolvePlayerNameFromState)(s, id));
    }
    handleRoll(state) {
        const status = String(state.status ?? '').toLowerCase();
        if (status !== 'started')
            return state;
        if (state.pending)
            return state;
        const currentId = state.turn?.currentPlayerId ?? null;
        if (currentId == null)
            return state;
        const meta = this.getMeta(state);
        const inWell = Boolean(meta.statuses?.well?.[currentId]);
        const rng = this.random.rollDice(meta, 6);
        const roll = rng.roll;
        let next = {
            ...state,
            metadata: { ...(state.metadata ?? {}), ...rng.meta },
            lastRoll: roll,
        };
        next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(state, currentId)} lance le dé : "${roll}".`);
        if (inWell) {
            if (roll !== 1) {
                const logged = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, currentId)} reste bloqué dans le puits.`);
                return this.turns.advanceTurn(logged, {
                    playerNameResolver: (s, id) => (0, player_name_helper_1.resolvePlayerNameFromState)(s, id),
                });
            }
            const metaAfter = this.getMeta(next);
            const well = { ...(metaAfter.statuses?.well ?? {}) };
            delete well[currentId];
            next = {
                ...next,
                metadata: {
                    ...(next.metadata ?? {}),
                    ...metaAfter,
                    statuses: { ...(metaAfter.statuses ?? {}), well },
                },
            };
            next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, currentId)} sort du puits.`);
        }
        const currentPos = meta.positions?.[currentId] ?? 1;
        const moved = this.move(currentPos, roll);
        next = this.applyLanding(next, currentId, moved, roll);
        const afterMeta = this.getMeta(next);
        if (afterMeta.winnerId != null) {
            return { ...next, status: 'finished' };
        }
        return this.turns.advanceTurn(next, {
            playerNameResolver: (s, id) => (0, player_name_helper_1.resolvePlayerNameFromState)(s, id),
        });
    }
    applyLanding(state, playerId, position, roll) {
        let next = state;
        let meta = this.getMeta(next);
        const tiles = Array.isArray(meta.tiles) ? meta.tiles : [];
        const tile = tiles[position];
        meta = {
            ...meta,
            positions: { ...(meta.positions ?? {}), [playerId]: position },
        };
        next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
        const label = tile?.label ?? `Case ${position}`;
        const compactLabel = this.compactTileLabel(label, position);
        next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, playerId)} place ${this.pawnPossessiveLabel(next, playerId)} en case ${position} (${compactLabel}).`);
        if (!tile)
            return next;
        if (tile.description && String(tile.description).trim()) {
            next = this.core.appendLog(next, String(tile.description).trim());
        }
        if (tile.type === 'finish') {
            next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, playerId)} a gagné !`);
            meta = this.getMeta(next);
            meta = { ...meta, winnerId: playerId };
            return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
        }
        if (tile.type === 'bridge') {
            const jumpTo = 12;
            next = this.core.appendLog(next, `Pont : avance directement à la case ${jumpTo}.`);
            return this.applyLanding(next, playerId, jumpTo, roll);
        }
        if (tile.type === 'death') {
            next = this.core.appendLog(next, 'Mort : retour au départ.');
            return this.applyLanding(next, playerId, tile.backTo, roll);
        }
        if (tile.type === 'labyrinth') {
            next = this.core.appendLog(next, `Labyrinthe : retour à la case ${tile.backTo}.`);
            return this.applyLanding(next, playerId, tile.backTo, roll);
        }
        if (tile.type === 'inn' || tile.type === 'prison') {
            const turns = tile.skipTurns ?? 1;
            next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, playerId)} perd ${turns} tour(s).`);
            meta = this.getMeta(next);
            const currentSkip = meta.statuses?.skipTurn?.[playerId] ?? 0;
            const statuses = meta.statuses ?? { skipTurn: {} };
            const skipTurn = {
                ...(statuses.skipTurn ?? {}),
                [playerId]: currentSkip + turns,
            };
            meta = { ...meta, statuses: { ...statuses, skipTurn } };
            return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
        }
        if (tile.type === 'magic_die') {
            const rng = this.random.rollDice(this.getMeta(next), 6);
            const magicRoll = rng.roll;
            next = {
                ...next,
                metadata: { ...(next.metadata ?? {}), ...rng.meta },
                lastRoll: magicRoll,
            };
            next = this.core.appendLog(next, `Dé magique : ${(0, player_name_helper_1.resolvePlayerNameFromState)(next, playerId)} lance "${magicRoll}".`);
            const delta = magicRoll <= 3 ? magicRoll : -magicRoll;
            const moved = this.move(position, delta);
            next = this.core.appendLog(next, magicRoll <= 3
                ? `Dé magique : avance de ${magicRoll} case(s).`
                : `Dé magique : recule de ${magicRoll} case(s).`);
            return this.applyLanding(next, playerId, moved, magicRoll);
        }
        if (tile.type === 'well') {
            const metaNow = this.getMeta(next);
            const well = { ...(metaNow.statuses?.well ?? {}) };
            well[playerId] = true;
            next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, playerId)} est bloqué dans le puits (il faut faire 1 pour sortir).`);
            return {
                ...next,
                metadata: {
                    ...(next.metadata ?? {}),
                    ...metaNow,
                    statuses: { ...(metaNow.statuses ?? {}), well },
                },
            };
        }
        if (tile.type === 'goose') {
            next = this.core.appendLog(next, `Oie : avance à nouveau de ${roll} case(s).`);
            const moved = this.move(position, roll);
            return this.applyLanding(next, playerId, moved, roll);
        }
        return next;
    }
    move(currentPos, roll) {
        const target = currentPos + roll;
        if (target < 0)
            return 0;
        if (target === 63)
            return 63;
        if (target < 63)
            return target;
        const overshoot = target - 63;
        return 63 - overshoot;
    }
    getMeta(state) {
        return (state.metadata ?? {});
    }
    pawnLabel(state, id) {
        const meta = this.getMeta(state);
        const pawnId = String(meta?.pawnByPlayerId?.[id] ?? '').trim();
        const pawn = Array.isArray(meta?.pawns)
            ? meta.pawns.find((p) => String(p?.id ?? '').trim() === pawnId)
            : null;
        const label = String(pawn?.label ?? '').trim();
        if (label)
            return label;
        return 'pion';
    }
    pawnPossessiveLabel(state, id) {
        const meta = this.getMeta(state);
        const pawnId = String(meta?.pawnByPlayerId?.[id] ?? '').trim();
        const pawn = Array.isArray(meta?.pawns)
            ? meta.pawns.find((p) => String(p?.id ?? '').trim() === pawnId)
            : null;
        const label = this.pawnLabel(state, id);
        const feminine = Boolean(pawn?.feminine);
        const possessive = feminine ? 'sa' : 'son';
        return `"${possessive} ${this.lowercaseFirst(label)}"`;
    }
    lowercaseFirst(value) {
        const text = String(value ?? '').trim();
        if (!text)
            return text;
        if (text.length === 1)
            return text.toLowerCase();
        return `${text.charAt(0).toLowerCase()}${text.slice(1)}`;
    }
    compactTileLabel(label, position) {
        const raw = String(label ?? '').trim();
        const withPrefix = new RegExp(`^case\\s+${position}\\s*-\\s*`, 'i');
        const stripped = raw.replace(withPrefix, '').trim();
        return stripped || raw || `Case ${position}`;
    }
    ensurePawnSelectionPrompt(state) {
        if (String(state.status ?? '').toLowerCase() !== 'started')
            return state;
        const players = Array.isArray(state.players) ? state.players : [];
        if (!players.length)
            return state;
        const meta = this.getMeta(state);
        const isAssigned = (playerId) => Boolean(meta.pawnByPlayerId?.[playerId]);
        const missingPlayers = players.filter((player) => !isAssigned(player.id));
        if (!missingPlayers.length) {
            return state.pending?.type === 'choose_pawn'
                ? { ...state, pending: null }
                : state;
        }
        if (state.pending?.type === 'choose_pawn') {
            const pendingPlayerId = Number(state.pending.playerId);
            if (Number.isFinite(pendingPlayerId) && !isAssigned(pendingPlayerId)) {
                return state;
            }
        }
        const usedPawnIds = new Set(Object.values(meta.pawnByPlayerId ?? {}).filter((pawnId) => typeof pawnId === 'string'));
        const availablePawns = (Array.isArray(meta.pawns) ? meta.pawns : [])
            .map((pawn) => ({
            id: String(pawn?.id ?? '').trim(),
            label: String(pawn?.label ?? '').trim(),
            feminine: Boolean(pawn?.feminine),
        }))
            .filter((pawn) => pawn.id.length > 0 && !usedPawnIds.has(pawn.id));
        const fallbackPawns = (Array.isArray(meta.pawns) ? meta.pawns : [])
            .map((pawn) => ({
            id: String(pawn?.id ?? '').trim(),
            label: String(pawn?.label ?? '').trim(),
            feminine: Boolean(pawn?.feminine),
        }))
            .filter((pawn) => pawn.id.length > 0);
        const pawns = availablePawns.length > 0 ? availablePawns : fallbackPawns;
        if (!pawns.length)
            return state;
        const pendingInfo = this.setupFlow.createSequentialPawnPending({
            players,
            startPlayerId: typeof state.turn?.currentPlayerId === 'number'
                ? state.turn.currentPlayerId
                : (players[0]?.id ?? null),
            isAssigned,
            pawns,
            pawnDataMapper: (choice) => ({
                id: String(choice?.id ?? '').trim(),
                label: String(choice?.label ?? '').trim(),
                feminine: Boolean(choice?.feminine),
            }),
        });
        if (!pendingInfo)
            return state;
        const next = {
            ...state,
            pending: pendingInfo.pending,
            turnIndex: pendingInfo.turnIndex,
            turn: {
                ...(state.turn ?? { direction: 1 }),
                currentPlayerId: pendingInfo.playerId,
                direction: 1,
            },
        };
        return next;
    }
    getTurnPolicies() {
        return this.turnPolicies ?? new turn_policies_service_1.TurnPoliciesService(this.core);
    }
};
exports.JeuOieActionService = JeuOieActionService;
exports.JeuOieActionService = JeuOieActionService = __decorate([
    (0, common_1.Injectable)(),
    __param(4, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [random_service_1.RandomService,
        turn_flow_service_1.TurnFlowService,
        game_core_service_1.GameCoreService,
        setup_flow_service_1.SetupFlowService,
        turn_policies_service_1.TurnPoliciesService])
], JeuOieActionService);
//# sourceMappingURL=jeu-oie-action.service.js.map