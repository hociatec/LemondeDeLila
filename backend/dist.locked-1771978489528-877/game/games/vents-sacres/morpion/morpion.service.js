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
exports.MorpionService = void 0;
const common_1 = require("@nestjs/common");
const game_registry_service_1 = require("../../../engine/services/game-registry.service");
const abstract_game_service_1 = require("../../../engine/abstract/abstract-game.service");
const morpion_presenter_1 = require("./morpion.presenter");
const shortcut_utils_1 = require("../../../engine/shortcuts/shortcut-utils");
const action_service_helper_1 = require("../../../actions/action-service.helper");
const game_log_text_helper_1 = require("../../../core/helpers/game-log-text.helper");
const log_style_helper_1 = require("../../../core/helpers/log-style.helper");
let MorpionService = class MorpionService extends abstract_game_service_1.AbstractGameService {
    presenter;
    gameType = 'morpion';
    category = 'JeuxDePlateaux';
    subcategory = 'Les Vents Sacrés';
    displayName = 'Morpion';
    description = 'Alignez 3 symboles sur une grille 3×3.';
    minPlayers = 2;
    maxPlayers = 2;
    constructor(registry, presenter) {
        super(registry);
        this.presenter = presenter;
    }
    hydrateInitialState(baseState) {
        const players = baseState.players ?? [];
        const firstPlayerId = players[0]?.id ?? null;
        const metadata = {
            size: 3,
            board: Array.from({ length: 9 }, () => 0),
            winnerId: null,
            draw: false,
        };
        return {
            ...baseState,
            status: 'started',
            phase: 'play',
            round: baseState.round ?? 1,
            turnIndex: baseState.turnIndex ?? 0,
            lastRoll: null,
            metadata,
            pending: null,
            turn: {
                ...(baseState.turn ?? { direction: 1 }),
                currentPlayerId: firstPlayerId,
                direction: 1,
                label: firstPlayerId
                    ? `Tour de ${players.find((p) => p?.id === firstPlayerId)?.username ?? `#${firstPlayerId}`}`
                    : undefined,
            },
            log: Array.isArray(baseState.log) ? baseState.log : [],
        };
    }
    applyActions(state, actions) {
        return (0, action_service_helper_1.applyActionsSequentially)(state, actions, (next, action) => this.applyOne(next, action));
    }
    getBotActions(state, botPlayerId) {
        const current = state.turn?.currentPlayerId ?? null;
        if (current !== botPlayerId)
            return [];
        if (String(state.status ?? '').toLowerCase() !== 'started')
            return [];
        const meta = (state.metadata ?? {});
        const size = meta.size ?? 3;
        const board = Array.isArray(meta.board) ? meta.board : [];
        const win = this.findWinningMove(board, size, botPlayerId);
        if (win) {
            return [{ type: 'morpion_play', payload: win }];
        }
        const opponentId = (state.players ?? [])
            .map((p) => p?.id)
            .find((id) => typeof id === 'number' && id !== botPlayerId);
        if (opponentId) {
            const block = this.findWinningMove(board, size, opponentId);
            if (block) {
                return [{ type: 'morpion_play', payload: block }];
            }
        }
        const preferred = [
            { x: 1, y: 1 },
            { x: 0, y: 0 },
            { x: 2, y: 0 },
            { x: 0, y: 2 },
            { x: 2, y: 2 },
        ];
        for (const pos of preferred) {
            if (pos.x < 0 || pos.y < 0 || pos.x >= size || pos.y >= size)
                continue;
            const idx = pos.y * size + pos.x;
            if ((board[idx] ?? 0) === 0) {
                return [{ type: 'morpion_play', payload: pos }];
            }
        }
        for (let y = 0; y < size; y += 1) {
            for (let x = 0; x < size; x += 1) {
                const idx = y * size + x;
                if ((board[idx] ?? 0) === 0) {
                    return [{ type: 'morpion_play', payload: { x, y } }];
                }
            }
        }
        return [];
    }
    exposeStateForUser(state, userId) {
        return this.presenter.exposeStateForUser(state, userId);
    }
    getShortcuts(_ctx) {
        return [(0, shortcut_utils_1.interfaceShortcut)('P', 'position'), (0, shortcut_utils_1.interfaceShortcut)('A', 'play')];
    }
    applyOne(state, action) {
        if (String(state.status ?? '').toLowerCase() !== 'started') {
            return state;
        }
        const type = (0, action_service_helper_1.normalizeActionType)(action);
        if (type !== 'morpion_play') {
            return state;
        }
        const actorId = typeof action?.meta?.actorId === 'number'
            ? action.meta.actorId
            : (state.turn?.currentPlayerId ?? null);
        if (!actorId) {
            return state;
        }
        const x = Number(action.payload?.x);
        const y = Number(action.payload?.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            return state;
        }
        const meta = { ...(state.metadata ?? {}) };
        const size = meta.size ?? 3;
        if (x < 0 || y < 0 || x >= size || y >= size) {
            return state;
        }
        const board = Array.isArray(meta.board)
            ? [...meta.board]
            : Array.from({ length: size * size }, () => 0);
        const idx = y * size + x;
        if (board[idx] !== 0) {
            return state;
        }
        board[idx] = actorId;
        const winnerId = this.detectWinner(board, size);
        const isDraw = !winnerId && board.every((v) => (v ?? 0) !== 0);
        const players = state.players ?? [];
        const nextPlayerId = this.nextPlayerId(players, actorId);
        const nextMeta = {
            ...meta,
            board,
            winnerId: winnerId ?? null,
            draw: isDraw,
        };
        const nextStatus = winnerId || isDraw ? 'finished' : state.status;
        const actorName = players.find((p) => p?.id === actorId)?.username ?? `#${actorId}`;
        const opponent = players.find((p) => p?.id != null && p.id !== actorId) ?? null;
        const opponentId = opponent?.id ?? null;
        const opponentName = opponent?.username ?? (opponentId != null ? `#${opponentId}` : null);
        const glyph = this.glyphForOwner(actorId, players);
        const cellRef = this.toCellRef({ x, y }, size);
        let log = this.appendLog(state.log, (0, game_log_text_helper_1.pawnPlacement)({
            playerLabel: actorName,
            pawnLabel: glyph,
            position: idx,
            tileLabel: cellRef,
        }));
        if (winnerId) {
            log = this.appendLog(log, 'Fin de la manche.');
            log = this.appendLog(log, (0, game_log_text_helper_1.victoryAnnouncement)(actorName));
            if (opponentName) {
                log = this.appendLog(log, `Défaite de ${opponentName}.`);
            }
            nextMeta.winnerPlayerId = winnerId;
            nextMeta.winnerId = winnerId;
            if (opponentId != null) {
                nextMeta.outcomesByPlayerId = {
                    [String(winnerId)]: 'won',
                    [String(opponentId)]: 'lost',
                };
            }
        }
        else if (isDraw) {
            log = this.appendLog(log, 'Fin de la manche.');
            log = this.appendLog(log, 'Match nul.');
            log = this.appendLog(log, 'Partie termin\u00e9e : match nul.');
        }
        return {
            ...state,
            status: nextStatus,
            metadata: nextMeta,
            log,
            turnIndex: (state.turnIndex ?? 0) + 1,
            turn: {
                ...(state.turn ?? { direction: 1 }),
                currentPlayerId: winnerId || isDraw
                    ? (state.turn?.currentPlayerId ?? null)
                    : nextPlayerId,
                direction: 1,
                label: winnerId || isDraw
                    ? undefined
                    : nextPlayerId
                        ? `Tour de ${players.find((p) => p?.id === nextPlayerId)?.username ?? `#${nextPlayerId}`}`
                        : undefined,
            },
        };
    }
    nextPlayerId(players, actorId) {
        if (!Array.isArray(players) || players.length < 2)
            return actorId;
        const ids = players
            .map((p) => p?.id)
            .filter((id) => typeof id === 'number');
        if (ids.length < 2)
            return actorId;
        const idx = ids.indexOf(actorId);
        if (idx < 0)
            return ids[0] ?? null;
        return ids[(idx + 1) % ids.length] ?? null;
    }
    detectWinner(board, _size) {
        const lines = [
            [0, 1, 2],
            [3, 4, 5],
            [6, 7, 8],
            [0, 3, 6],
            [1, 4, 7],
            [2, 5, 8],
            [0, 4, 8],
            [2, 4, 6],
        ];
        for (const [a, b, c] of lines) {
            const v = board[a] ?? 0;
            if (v && v === (board[b] ?? 0) && v === (board[c] ?? 0)) {
                return v;
            }
        }
        return null;
    }
    findWinningMove(board, size, playerId) {
        if (!Array.isArray(board) || board.length < size * size)
            return null;
        for (let y = 0; y < size; y += 1) {
            for (let x = 0; x < size; x += 1) {
                const idx = y * size + x;
                if ((board[idx] ?? 0) !== 0)
                    continue;
                const candidate = [...board];
                candidate[idx] = playerId;
                if (this.detectWinner(candidate, size) === playerId) {
                    return { x, y };
                }
            }
        }
        return null;
    }
    appendLog(log, message) {
        const trimmed = (0, log_style_helper_1.normalizeGameLogMessage)(message);
        const next = Array.isArray(log) ? [...log] : [];
        if (!trimmed) {
            return next;
        }
        next.push({ message: trimmed, timestamp: new Date().toISOString() });
        return next;
    }
    toCellRef(pos, size) {
        const colIndex = Math.max(0, Math.min(size - 1, Math.floor(pos.x)));
        const rowIndex = Math.max(0, Math.min(size - 1, Math.floor(pos.y)));
        const col = String.fromCharCode(65 + colIndex);
        const row = rowIndex + 1;
        return `${col}${row}`;
    }
    glyphForOwner(ownerId, players) {
        const player0 = players[0]?.id ?? 1;
        const player1 = players[1]?.id ?? 2;
        if (ownerId === player0)
            return 'X';
        if (ownerId === player1)
            return 'O';
        return '@';
    }
};
exports.MorpionService = MorpionService;
exports.MorpionService = MorpionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [game_registry_service_1.GameRegistryService,
        morpion_presenter_1.MorpionPresenter])
], MorpionService);
//# sourceMappingURL=morpion.service.js.map