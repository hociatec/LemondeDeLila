"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "MorpionService", {
    enumerable: true,
    get: function() {
        return MorpionService;
    }
});
const _common = require("@nestjs/common");
const _gameregistryservice = require("../../../engine/services/game-registry.service");
const _abstractgameservice = require("../../../engine/abstract/abstract-game.service");
const _morpionpresenter = require("./morpion.presenter");
const _shortcututils = require("../../../engine/shortcuts/shortcut-utils");
const _actionservicehelper = require("../../../actions/action-service.helper");
const _gamelogtexthelper = require("../../../core/helpers/game-log-text.helper");
const _logstylehelper = require("../../../core/helpers/log-style.helper");
const _morpionpawns = require("./definitions/morpion.pawns");
const _seededrng = require("../../../../common/utils/seeded-rng");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let MorpionService = class MorpionService extends _abstractgameservice.AbstractGameService {
    autoAssignBotPawns(players, assigned) {
        const out = {
            ...assigned ?? {}
        };
        const assignedBots = [];
        const used = new Set(Object.values(out));
        for (const bot of (players ?? []).filter((p)=>p?.isBot === true)){
            if (out[String(bot.id)]) continue;
            const pick = MorpionService.PawnChoices.find((p)=>!used.has(p.id));
            if (!pick) break;
            out[String(bot.id)] = pick.id;
            used.add(pick.id);
            assignedBots.push({
                playerId: bot.id,
                pawnId: pick.id
            });
        }
        return {
            map: out,
            assignedBots
        };
    }
    pickRandomHumanNeedingPawn(players, assigned, meta) {
        const need = (players ?? []).filter((p)=>p?.isBot !== true && typeof p?.id === 'number' && !assigned[String(p.id)]);
        if (need.length <= 0) {
            return {
                playerId: null,
                meta
            };
        }
        if (need.length === 1) {
            return {
                playerId: need[0].id,
                meta
            };
        }
        const { value: idx, meta: updated } = (0, _seededrng.nextRngInt)(meta, need.length);
        return {
            playerId: need[idx]?.id ?? need[0].id,
            meta: updated
        };
    }
    hydrateInitialState(baseState) {
        const players = baseState.players ?? [];
        const baseMeta = baseState.metadata && typeof baseState.metadata === 'object' ? baseState.metadata : {};
        const botAssigned = this.autoAssignBotPawns(players, {});
        const assignedBots = botAssigned.map;
        const { playerId: firstPlayerId, meta: metaAfterPick } = this.pickRandomHumanNeedingPawn(players, assignedBots, baseMeta);
        const metadata = {
            size: 3,
            board: Array.from({
                length: 9
            }, ()=>0),
            glyphByPlayerId: assignedBots,
            winnerId: null,
            draw: false
        };
        const pending = firstPlayerId ? this.buildChoosePawnPending(players, firstPlayerId, assignedBots) : null;
        // Announce bot pawn picks so humans know what each bot is using.
        let log = Array.isArray(baseState.log) ? baseState.log : [];
        for (const entry of botAssigned.assignedBots){
            const botName = players.find((p)=>p?.id === entry.playerId)?.username ?? `#${entry.playerId}`;
            const pawn = MorpionService.PawnChoices.find((p)=>p.id === entry.pawnId) ?? null;
            const pawnLabel = pawn?.label ?? entry.pawnId;
            log = this.appendLog(log, `${botName} choisit le pion ${pawnLabel}.`);
        }
        return {
            ...baseState,
            status: 'started',
            phase: 'play',
            round: baseState.round ?? 1,
            turnIndex: baseState.turnIndex ?? 0,
            lastRoll: null,
            metadata: {
                ...metaAfterPick,
                ...metadata
            },
            pending,
            turn: {
                ...baseState.turn ?? {
                    direction: 1
                },
                currentPlayerId: firstPlayerId,
                direction: 1,
                label: firstPlayerId && pending ? `Choix du pion - ${players.find((p)=>p?.id === firstPlayerId)?.username ?? `#${firstPlayerId}`}` : firstPlayerId ? `Tour de ${players.find((p)=>p?.id === firstPlayerId)?.username ?? `#${firstPlayerId}`}` : undefined
            },
            log
        };
    }
    applyActions(state, actions) {
        return (0, _actionservicehelper.applyActionsSequentially)(state, actions, (next, action)=>this.applyOne(next, action));
    }
    getBotActions(state, botPlayerId) {
        const current = state.turn?.currentPlayerId ?? null;
        if (current !== botPlayerId) return [];
        if (String(state.status ?? '').toLowerCase() !== 'started') return [];
        const choosePawnPending = this.asChoosePawnPending(state.pending);
        if (choosePawnPending && choosePawnPending.playerId === botPlayerId) {
            const available = this.availablePawnIdsFromPending(choosePawnPending);
            if (available.length > 0) {
                return [
                    {
                        type: 'choose_pawn',
                        payload: {
                            pawnId: available[0]
                        }
                    }
                ];
            }
            return [];
        }
        const meta = state.metadata ?? {};
        const size = meta.size ?? 3;
        const board = Array.isArray(meta.board) ? meta.board : [];
        // 1) Win if possible.
        const win = this.findWinningMove(board, size, botPlayerId);
        if (win) {
            return [
                {
                    type: 'morpion_play',
                    payload: win
                }
            ];
        }
        // 2) Block opponent immediate win if possible.
        const opponentId = (state.players ?? []).map((p)=>p?.id).find((id)=>typeof id === 'number' && id !== botPlayerId);
        if (opponentId) {
            const block = this.findWinningMove(board, size, opponentId);
            if (block) {
                return [
                    {
                        type: 'morpion_play',
                        payload: block
                    }
                ];
            }
        }
        // 3) Otherwise, pick center, then corners, then first empty.
        const preferred = [
            {
                x: 1,
                y: 1
            },
            {
                x: 0,
                y: 0
            },
            {
                x: 2,
                y: 0
            },
            {
                x: 0,
                y: 2
            },
            {
                x: 2,
                y: 2
            }
        ];
        for (const pos of preferred){
            if (pos.x < 0 || pos.y < 0 || pos.x >= size || pos.y >= size) continue;
            const idx = pos.y * size + pos.x;
            if ((board[idx] ?? 0) === 0) {
                return [
                    {
                        type: 'morpion_play',
                        payload: pos
                    }
                ];
            }
        }
        for(let y = 0; y < size; y += 1){
            for(let x = 0; x < size; x += 1){
                const idx = y * size + x;
                if ((board[idx] ?? 0) === 0) {
                    return [
                        {
                            type: 'morpion_play',
                            payload: {
                                x,
                                y
                            }
                        }
                    ];
                }
            }
        }
        return [];
    }
    exposeStateForUser(state, userId) {
        return this.presenter.exposeStateForUser(state, userId);
    }
    getShortcuts(_ctx) {
        return [
            (0, _shortcututils.interfaceShortcut)('P', 'position'),
            (0, _shortcututils.interfaceShortcut)('A', 'play')
        ];
    }
    applyOne(state, action) {
        if (String(state.status ?? '').toLowerCase() !== 'started') {
            return state;
        }
        const type = (0, _actionservicehelper.normalizeActionType)(action);
        if (type === 'choose_pawn') {
            return this.applyChoosePawn(state, action);
        }
        if (type !== 'morpion_play') {
            return state;
        }
        if (this.asChoosePawnPending(state.pending) != null) {
            return state;
        }
        const actorId = typeof action?.meta?.actorId === 'number' ? action.meta.actorId : state.turn?.currentPlayerId ?? null;
        if (!actorId) {
            return state;
        }
        const x = Number(action.payload?.x);
        const y = Number(action.payload?.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            return state;
        }
        const meta = {
            ...state.metadata ?? {}
        };
        const size = meta.size ?? 3;
        if (x < 0 || y < 0 || x >= size || y >= size) {
            return state;
        }
        const board = Array.isArray(meta.board) ? [
            ...meta.board
        ] : Array.from({
            length: size * size
        }, ()=>0);
        const idx = y * size + x;
        if (board[idx] !== 0) {
            return state;
        }
        board[idx] = actorId;
        const winnerId = this.detectWinner(board, size);
        const isDraw = !winnerId && board.every((v)=>(v ?? 0) !== 0);
        const players = state.players ?? [];
        const nextPlayerId = this.nextPlayerId(players, actorId);
        const nextMeta = {
            ...meta,
            board,
            winnerId: winnerId ?? null,
            draw: isDraw
        };
        const nextStatus = winnerId || isDraw ? 'finished' : state.status;
        const actorName = players.find((p)=>p?.id === actorId)?.username ?? `#${actorId}`;
        const opponent = players.find((p)=>p?.id != null && p.id !== actorId) ?? null;
        const opponentId = opponent?.id ?? null;
        const opponentName = opponent?.username ?? (opponentId != null ? `#${opponentId}` : null);
        const pawnLabel = this.pawnLabelForOwner(actorId, players, meta);
        const cellRef = this.toCellRef({
            x,
            y
        }, size);
        let log = this.appendLog(state.log, `${actorName} place ${pawnLabel} en ${cellRef}.`);
        if (winnerId) {
            log = this.appendLog(log, 'Fin de la partie.');
            log = this.appendLog(log, (0, _gamelogtexthelper.victoryAnnouncement)(actorName));
            if (opponentName) {
                log = this.appendLog(log, `Défaite de ${opponentName}.`);
            }
            nextMeta.winnerPlayerId = winnerId;
            nextMeta.winnerId = winnerId;
            if (opponentId != null) {
                nextMeta.outcomesByPlayerId = {
                    [String(winnerId)]: 'won',
                    [String(opponentId)]: 'lost'
                };
            }
        } else if (isDraw) {
            log = this.appendLog(log, 'Fin de la partie.');
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
                ...state.turn ?? {
                    direction: 1
                },
                currentPlayerId: winnerId || isDraw ? state.turn?.currentPlayerId ?? null : nextPlayerId,
                direction: 1,
                label: winnerId || isDraw ? undefined : nextPlayerId ? `Tour de ${players.find((p)=>p?.id === nextPlayerId)?.username ?? `#${nextPlayerId}`}` : undefined
            }
        };
    }
    nextPlayerId(players, actorId) {
        if (!Array.isArray(players) || players.length < 2) return actorId;
        const ids = players.map((p)=>p?.id).filter((id)=>typeof id === 'number');
        if (ids.length < 2) return actorId;
        const idx = ids.indexOf(actorId);
        if (idx < 0) return ids[0] ?? null;
        return ids[(idx + 1) % ids.length] ?? null;
    }
    detectWinner(board, _size) {
        const lines = [
            [
                0,
                1,
                2
            ],
            [
                3,
                4,
                5
            ],
            [
                6,
                7,
                8
            ],
            [
                0,
                3,
                6
            ],
            [
                1,
                4,
                7
            ],
            [
                2,
                5,
                8
            ],
            [
                0,
                4,
                8
            ],
            [
                2,
                4,
                6
            ]
        ];
        for (const [a, b, c] of lines){
            const v = board[a] ?? 0;
            if (v && v === (board[b] ?? 0) && v === (board[c] ?? 0)) {
                return v;
            }
        }
        return null;
    }
    findWinningMove(board, size, playerId) {
        if (!Array.isArray(board) || board.length < size * size) return null;
        for(let y = 0; y < size; y += 1){
            for(let x = 0; x < size; x += 1){
                const idx = y * size + x;
                if ((board[idx] ?? 0) !== 0) continue;
                const candidate = [
                    ...board
                ];
                candidate[idx] = playerId;
                if (this.detectWinner(candidate, size) === playerId) {
                    return {
                        x,
                        y
                    };
                }
            }
        }
        return null;
    }
    appendLog(log, message) {
        const trimmed = (0, _logstylehelper.normalizeGameLogMessage)(message);
        const next = Array.isArray(log) ? [
            ...log
        ] : [];
        if (!trimmed) {
            return next;
        }
        next.push({
            message: trimmed,
            timestamp: new Date().toISOString()
        });
        return next;
    }
    toCellRef(pos, size) {
        const colIndex = Math.max(0, Math.min(size - 1, Math.floor(pos.x)));
        const rowIndex = Math.max(0, Math.min(size - 1, Math.floor(pos.y)));
        const col = String.fromCharCode(65 + colIndex);
        // Align with other grid games (ex: Corridor): row numbers go from top (size) to bottom (1).
        // Internal y grows downward (0 at top), so invert for human-readable coordinates.
        const row = Math.max(1, size - rowIndex);
        return `${col}${row}`;
    }
    glyphForOwner(ownerId, players, meta) {
        const mapped = String((meta?.glyphByPlayerId ?? {})[String(ownerId)] ?? '').trim().toLowerCase();
        const mappedPawn = MorpionService.PawnChoices.find((pawn)=>pawn.id === mapped);
        if (mappedPawn?.glyph) {
            return mappedPawn.glyph;
        }
        const player0 = players[0]?.id ?? 1;
        const player1 = players[1]?.id ?? 2;
        if (ownerId === player0) return MorpionService.PawnChoices[0]?.glyph ?? 'V';
        if (ownerId === player1) return MorpionService.PawnChoices[1]?.glyph ?? 'E';
        return '@';
    }
    pawnLabelForOwner(ownerId, players, meta) {
        const pawnId = String((meta?.glyphByPlayerId ?? {})[String(ownerId)] ?? '').trim().toLowerCase();
        const pawn = MorpionService.PawnChoices.find((p)=>p.id === pawnId) ?? null;
        if (pawn?.label) return pawn.label;
        if (pawnId) return pawnId;
        return this.glyphForOwner(ownerId, players, meta);
    }
    applyChoosePawn(state, action) {
        const pending = this.asChoosePawnPending(state.pending);
        if (!pending) {
            return state;
        }
        const actorId = typeof action?.meta?.actorId === 'number' ? action.meta.actorId : state.turn?.currentPlayerId ?? null;
        if (!actorId || actorId !== pending.playerId) {
            return state;
        }
        const pawnId = this.normalizePawnChoice(action.payload?.pawnId ?? action.payload?.pawn ?? action.payload?.value);
        if (!pawnId) {
            return state;
        }
        const available = this.availablePawnIdsFromPending(pending);
        if (!available.includes(pawnId)) {
            return state;
        }
        const players = Array.isArray(state.players) ? state.players : [];
        const metaAll = state.metadata && typeof state.metadata === 'object' ? state.metadata : {};
        const meta = {
            ...metaAll
        };
        const glyphByPlayerId = {
            ...meta.glyphByPlayerId ?? {}
        };
        glyphByPlayerId[String(actorId)] = pawnId;
        const botAssigned = this.autoAssignBotPawns(players, glyphByPlayerId);
        const withBotsAssigned = botAssigned.map;
        const pawnLabel = MorpionService.PawnChoices.find((pawn)=>pawn.id === pawnId)?.label ?? pawnId;
        let log = this.appendLog(state.log, `${players.find((p)=>p?.id === actorId)?.username ?? `#${actorId}`} choisit le pion ${pawnLabel}.`);
        for (const entry of botAssigned.assignedBots){
            const botName = players.find((p)=>p?.id === entry.playerId)?.username ?? `#${entry.playerId}`;
            const pawn = MorpionService.PawnChoices.find((p)=>p.id === entry.pawnId) ?? null;
            const label = pawn?.label ?? entry.pawnId;
            log = this.appendLog(log, `${botName} choisit le pion ${label}.`);
        }
        const { playerId: nextPlayerId, meta: metaAfterPick } = this.pickRandomHumanNeedingPawn(players, withBotsAssigned, metaAll);
        if (typeof nextPlayerId === 'number') {
            const nextName = players.find((p)=>p?.id === nextPlayerId)?.username ?? `#${nextPlayerId}`;
            log = this.appendLog(log, `C'est à ${nextName} de choisir un pion.`);
            return {
                ...state,
                metadata: {
                    ...metaAfterPick,
                    ...meta,
                    glyphByPlayerId: withBotsAssigned
                },
                pending: this.buildChoosePawnPending(players, nextPlayerId, withBotsAssigned),
                turn: {
                    ...state.turn ?? {
                        direction: 1
                    },
                    currentPlayerId: nextPlayerId,
                    direction: 1,
                    label: `Choix du pion - ${players.find((p)=>p?.id === nextPlayerId)?.username ?? `#${nextPlayerId}`}`
                },
                log
            };
        }
        const startPlayerId = players[0]?.id ?? null;
        if (typeof startPlayerId === 'number' && Number.isFinite(startPlayerId)) {
            const startName = players.find((p)=>p?.id === startPlayerId)?.username ?? `#${startPlayerId}`;
            log = this.appendLog(log, `C'est au tour de ${startName}.`);
        }
        return {
            ...state,
            metadata: {
                ...metaAfterPick,
                ...meta,
                glyphByPlayerId: withBotsAssigned
            },
            pending: null,
            turn: {
                ...state.turn ?? {
                    direction: 1
                },
                currentPlayerId: startPlayerId,
                direction: 1,
                label: startPlayerId ? `Tour de ${players.find((p)=>p?.id === startPlayerId)?.username ?? `#${startPlayerId}`}` : undefined
            },
            log
        };
    }
    buildChoosePawnPending(players, playerId, assigned) {
        const taken = new Set(Object.values(assigned ?? {}).map((v)=>this.normalizePawnChoice(v)).filter((v)=>v != null));
        const available = MorpionService.PawnChoices.filter((c)=>!taken.has(c.id));
        const availableLabels = available.map((c)=>c.label);
        return {
            type: 'choose_pawn',
            playerId,
            blocking: true,
            label: `Choisissez votre pion (${availableLabels.join(' / ')}).`,
            choices: available.map((c)=>`${c.label} - ${c.description}`),
            data: {
                pawns: available.map((c)=>({
                        id: c.id,
                        label: c.label,
                        description: c.description,
                        glyph: c.glyph
                    }))
            }
        };
    }
    asChoosePawnPending(pending) {
        if (!pending || typeof pending !== 'object') {
            return null;
        }
        const type = String(pending.type ?? '').trim().toLowerCase();
        if (type !== 'choose_pawn') {
            return null;
        }
        const playerId = Number(pending.playerId);
        if (!Number.isFinite(playerId)) {
            return null;
        }
        const data = pending.data && typeof pending.data === 'object' ? pending.data : undefined;
        return {
            playerId,
            data
        };
    }
    availablePawnIdsFromPending(pending) {
        const pawns = pending.data?.pawns;
        if (!Array.isArray(pawns)) {
            return [];
        }
        return pawns.map((entry)=>this.normalizePawnChoice(entry?.id)).filter((entry)=>entry != null);
    }
    normalizePawnChoice(value) {
        let normalized = '';
        if (typeof value === 'string') {
            normalized = value.trim().toLowerCase();
        } else if (typeof value === 'number' && Number.isFinite(value)) {
            normalized = String(value).trim().toLowerCase();
        }
        // Backward compatibility with legacy X/O clients.
        if (normalized === 'x') {
            return MorpionService.PawnChoices[0]?.id ?? null;
        }
        if (normalized === 'o') {
            return MorpionService.PawnChoices[1]?.id ?? null;
        }
        const matched = MorpionService.PawnChoices.find((pawn)=>pawn.id === normalized);
        if (matched) {
            return matched.id;
        }
        return null;
    }
    constructor(registry, presenter){
        super(registry), this.presenter = presenter, this.gameType = 'morpion', this.category = 'JeuxDePlateaux', this.subcategory = 'Les Vents Sacrés', this.displayName = 'Morpion', this.description = 'Alignez 3 symboles sur une grille 3×3.', this.minPlayers = 2, this.maxPlayers = 2;
    }
};
MorpionService.PawnChoices = _morpionpawns.MORPION_PAWNS;
MorpionService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _gameregistryservice.GameRegistryService === "undefined" ? Object : _gameregistryservice.GameRegistryService,
        typeof _morpionpresenter.MorpionPresenter === "undefined" ? Object : _morpionpresenter.MorpionPresenter
    ])
], MorpionService);
