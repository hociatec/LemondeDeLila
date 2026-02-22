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
exports.OdysseeActionService = void 0;
const common_1 = require("@nestjs/common");
const action_service_helper_1 = require("../../../../actions/action-service.helper");
const game_core_service_1 = require("../../../../core/services/game-core.service");
const random_service_1 = require("../../../../modules/random/services/random.service");
const turn_flow_service_1 = require("../../../../modules/turn/services/turn-flow.service");
const ODYSSEE_DEFAULT_PAWN_NAMES = ['Aube', 'Brise', 'Comete', 'Dune'];
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
let OdysseeActionService = class OdysseeActionService {
    random;
    turns;
    core;
    constructor(random, turns, core) {
        this.random = random;
        this.turns = turns;
        this.core = core;
    }
    applyActions(state, actions) {
        const next = (0, action_service_helper_1.applyActionsSequentially)(state, actions, (next, action) => {
            const type = (0, action_service_helper_1.normalizeActionType)(action);
            return (0, action_service_helper_1.dispatchByActionType)(type, {
                roll: () => {
                    next = this.handleRoll(next);
                    return next;
                },
                ROLL_DICE: () => {
                    next = this.handleRoll(next);
                    return next;
                },
                roll_dice: () => {
                    next = this.handleRoll(next);
                    return next;
                },
                move_pawn: () => {
                    next = this.handleMovePawn(next, action);
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
        const rng = this.random.rollDice(meta, 6);
        meta = { ...meta, ...asPartialMeta(rng.meta) };
        const roll = rng.roll;
        let next = {
            ...state,
            metadata: { ...(state.metadata ?? {}), ...meta },
            lastRoll: roll,
        };
        next = this.core.appendLog(next, `${this.playerName(next, currentId)} lance le dé : "${roll}".`);
        const moves = this.computeMoves(next, currentId, roll);
        if (moves.length === 0) {
            next = this.core.appendLog(next, `${this.playerName(next, currentId)} ne peut jouer aucun pion.`);
            return this.endTurn(next, false);
        }
        if (moves.length === 1) {
            next = this.applyMove(next, currentId, moves[0]);
            if (this.getMeta(next).winnerId)
                return next;
            return this.endTurn(next, roll === 6);
        }
        const pending = {
            type: 'choose_pawn',
            playerId: currentId,
            blocking: true,
            choices: moves.map((m) => m.label),
            data: {
                roll,
                moves: moves.map((m) => ({
                    pawnIndex: m.pawnIndex,
                    targetProgress: m.targetProgress,
                })),
            },
        };
        return { ...next, pending };
    }
    handleMovePawn(state, action) {
        if (String(state.status ?? '').toLowerCase() !== 'started')
            return state;
        const currentId = state.turn?.currentPlayerId ?? null;
        if (currentId == null)
            return state;
        const pending = state.pending;
        const pendingRow = asRecord(pending);
        if (!pending ||
            pendingRow.type !== 'choose_pawn' ||
            Number(pendingRow.playerId ?? null) !== currentId)
            return state;
        const payload = asRecord(action.payload);
        const pawnIndex = Number(payload.pawnIndex);
        const targetProgress = Number(payload.targetProgress);
        if (!Number.isFinite(pawnIndex) || !Number.isFinite(targetProgress))
            return state;
        const pendingData = asRecord(pendingRow.data);
        const roll = Number(pendingData.roll);
        const moves = Array.isArray(pendingData.moves)
            ? pendingData.moves
                .map((entry) => {
                const row = asRecord(entry);
                return {
                    pawnIndex: Number(row.pawnIndex),
                    targetProgress: Number(row.targetProgress),
                };
            })
                .filter((move) => Number.isFinite(move.pawnIndex) &&
                Number.isFinite(move.targetProgress))
            : [];
        if (!moves.some((m) => m.pawnIndex === pawnIndex && m.targetProgress === targetProgress)) {
            return { ...state, pending: null };
        }
        const label = this.choicePawnLabel(state, currentId, pawnIndex);
        let next = { ...state, pending: null };
        next = this.applyMove(next, currentId, {
            pawnIndex,
            targetProgress,
            label,
        });
        if (this.getMeta(next).winnerId)
            return next;
        return this.endTurn(next, roll === 6);
    }
    computeMoves(state, playerId, roll) {
        const meta = this.getMeta(state);
        const pawns = Array.isArray(meta.pawnsByPlayer?.[playerId])
            ? meta.pawnsByPlayer[playerId]
            : [];
        const trackLen = meta.trackLength;
        const homeLen = meta.homeLength;
        const pathLen = trackLen + homeLen;
        const ownTrackPositions = new Set();
        const ownHomeProgresses = new Set();
        const offset = meta.offsets?.[playerId] ?? 0;
        for (const p of pawns) {
            const prog = typeof p.progress === 'number' ? p.progress : -1;
            if (prog >= 0 && prog < trackLen) {
                ownTrackPositions.add((offset + prog) % trackLen);
            }
            else if (prog >= trackLen && prog < pathLen) {
                ownHomeProgresses.add(prog);
            }
        }
        const moves = [];
        for (const pawn of pawns) {
            const prog = typeof pawn.progress === 'number' ? pawn.progress : -1;
            if (prog < 0) {
                if (roll !== 6)
                    continue;
                const pos = offset;
                if (ownTrackPositions.has(pos))
                    continue;
                moves.push({
                    pawnIndex: pawn.pawnIndex,
                    targetProgress: 0,
                    label: `Sortir ${this.choicePawnLabel(state, playerId, pawn.pawnIndex)}`,
                });
                continue;
            }
            if (prog >= pathLen)
                continue;
            const target = prog + roll;
            if (target > pathLen)
                continue;
            if (target < trackLen) {
                const pos = (offset + target) % trackLen;
                if (ownTrackPositions.has(pos))
                    continue;
            }
            else if (target >= trackLen && target < pathLen) {
                if (ownHomeProgresses.has(target))
                    continue;
            }
            moves.push({
                pawnIndex: pawn.pawnIndex,
                targetProgress: target,
                label: `Jouer ${this.choicePawnLabel(state, playerId, pawn.pawnIndex)}`,
            });
        }
        return moves;
    }
    applyMove(state, playerId, move) {
        let meta = this.getMeta(state);
        const trackLen = meta.trackLength;
        const homeLen = meta.homeLength;
        const pathLen = trackLen + homeLen;
        const pawns = Array.isArray(meta.pawnsByPlayer?.[playerId])
            ? meta.pawnsByPlayer[playerId]
            : [];
        const updated = pawns.map((p) => p.pawnIndex === move.pawnIndex
            ? { ...p, progress: move.targetProgress }
            : p);
        meta = {
            ...meta,
            pawnsByPlayer: { ...(meta.pawnsByPlayer ?? {}), [playerId]: updated },
        };
        let next = {
            ...state,
            metadata: { ...(state.metadata ?? {}), ...meta },
        };
        const pawnLabel = this.pawnLabel(next, playerId, move.pawnIndex);
        const offset = meta.offsets?.[playerId] ?? 0;
        if (move.targetProgress >= 0 && move.targetProgress < trackLen) {
            const pos = (offset + move.targetProgress) % trackLen;
            next = this.core.appendLog(next, `${this.playerName(next, playerId)} place ${pawnLabel} en case ${pos + 1}.`);
        }
        else if (move.targetProgress >= trackLen &&
            move.targetProgress < pathLen) {
            const homeIndex = move.targetProgress - trackLen + 1;
            next = this.core.appendLog(next, `${this.playerName(next, playerId)} met ${pawnLabel} dans l'échelle finale (${homeIndex}/${homeLen}).`);
        }
        else {
            next = this.core.appendLog(next, `${this.playerName(next, playerId)} met ${pawnLabel} à l'arrivée.`);
        }
        next = this.applyCapture(next, playerId, move.pawnIndex, move.targetProgress);
        meta = this.getMeta(next);
        if (this.isWinner(meta, playerId, pathLen)) {
            next = this.core.appendLog(next, `${this.playerName(next, playerId)} a gagné !`);
            return {
                ...next,
                status: 'finished',
                metadata: { ...(next.metadata ?? {}), ...meta, winnerId: playerId },
            };
        }
        return next;
    }
    applyCapture(state, moverId, _moverPawnIndex, moverProgress) {
        const meta = this.getMeta(state);
        if (moverProgress < 0 || moverProgress >= meta.trackLength)
            return state;
        const moverOffset = meta.offsets?.[moverId] ?? 0;
        const moverPos = (moverOffset + moverProgress) % meta.trackLength;
        const players = Array.isArray(state.players) ? state.players : [];
        let next = state;
        for (const p of players) {
            if (p.id === moverId)
                continue;
            const offset = meta.offsets?.[p.id] ?? 0;
            const pawns = Array.isArray(meta.pawnsByPlayer?.[p.id])
                ? meta.pawnsByPlayer[p.id]
                : [];
            const updated = pawns.map((pawn) => {
                const row = asRecord(pawn);
                const prog = typeof row.progress === 'number' ? row.progress : -1;
                if (prog < 0 || prog >= meta.trackLength)
                    return pawn;
                const pos = (offset + prog) % meta.trackLength;
                if (pos !== moverPos)
                    return pawn;
                next = this.core.appendLog(next, `${this.playerName(next, moverId)} capture ${this.playerName(next, p.id)} (${this.pawnLabel(next, p.id, Number(row.pawnIndex))}) : retour à la base.`);
                return { ...row, progress: -1 };
            });
            next = {
                ...next,
                metadata: {
                    ...(next.metadata ?? {}),
                    ...meta,
                    pawnsByPlayer: { ...(meta.pawnsByPlayer ?? {}), [p.id]: updated },
                },
            };
        }
        return next;
    }
    isWinner(meta, playerId, pathLen) {
        const pawns = Array.isArray(meta.pawnsByPlayer?.[playerId])
            ? meta.pawnsByPlayer[playerId]
            : [];
        return (pawns.length === 4 &&
            pawns.every((p) => typeof p.progress === 'number' && p.progress >= pathLen));
    }
    endTurn(state, extraTurn) {
        if (extraTurn) {
            const currentId = state.turn?.currentPlayerId ?? null;
            const who = currentId != null ? this.playerName(state, currentId) : 'Le joueur';
            return this.core.appendLog(state, `6 : ${who} rejoue.`);
        }
        return this.turns.advanceTurn(state);
    }
    getMeta(state) {
        return (state.metadata ?? {});
    }
    playerName(state, id) {
        const players = Array.isArray(state.players) ? state.players : [];
        const p = players.find((x) => x?.id === id);
        const u = p?.username && String(p.username).trim()
            ? String(p.username).trim()
            : null;
        return u ?? `Joueur ${id}`;
    }
    pawnLabel(state, playerId, pawnIndex) {
        return `"${this.resolvePawnName(state, playerId, pawnIndex)}"`;
    }
    choicePawnLabel(state, playerId, pawnIndex) {
        return `"${this.resolvePawnName(state, playerId, pawnIndex)}"`;
    }
    resolvePawnName(state, playerId, pawnIndex) {
        const metaRecord = asRecord(this.getMeta(state));
        const byPlayer = asRecord(metaRecord.pawnNamesByPlayer);
        const namesValue = byPlayer[String(playerId)];
        const names = Array.isArray(namesValue) ? namesValue : [];
        const byIndex = typeof names[pawnIndex] === 'string'
            ? String(names[pawnIndex]).trim()
            : '';
        if (byIndex)
            return byIndex;
        const players = Array.isArray(state.players) ? state.players : [];
        const p = players.find((x) => x?.id === playerId) ?? null;
        const singlePawn = typeof p?.pawn === 'string' ? String(p.pawn).trim() : '';
        if (singlePawn)
            return singlePawn;
        const base = ODYSSEE_DEFAULT_PAWN_NAMES[Math.abs(Math.trunc(pawnIndex)) % ODYSSEE_DEFAULT_PAWN_NAMES.length];
        return `${base} (${this.playerName(state, playerId)})`;
    }
};
exports.OdysseeActionService = OdysseeActionService;
exports.OdysseeActionService = OdysseeActionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [random_service_1.RandomService,
        turn_flow_service_1.TurnFlowService,
        game_core_service_1.GameCoreService])
], OdysseeActionService);
//# sourceMappingURL=odyssee-action.service.js.map