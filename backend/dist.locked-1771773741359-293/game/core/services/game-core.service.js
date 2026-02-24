"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameCoreService = void 0;
const common_1 = require("@nestjs/common");
const seeded_rng_1 = require("../../../common/utils/seeded-rng");
const seeded_shuffle_1 = require("../../../common/utils/seeded-shuffle");
const log_style_helper_1 = require("../helpers/log-style.helper");
function toPlayerNameText(raw) {
    if (typeof raw === 'string')
        return raw;
    if (typeof raw === 'number' || typeof raw === 'boolean') {
        return String(raw);
    }
    return '';
}
let GameCoreService = class GameCoreService {
    sanitizePlayerName(raw) {
        let name = toPlayerNameText(raw).trim();
        name = name
            .replace(/[\r\n\t]+/g, ' ')
            .replace(/\s{2,}/g, ' ')
            .trim();
        if (name.startsWith('"') && name.endsWith('"')) {
            name = name.slice(1, -1).trim();
        }
        const lowered = name.toLowerCase();
        if (lowered.endsWith('(zone de jeu)') ||
            lowered.endsWith('(zone de jeux)') ||
            lowered.endsWith('(game zone)')) {
            const openParen = name.lastIndexOf('(');
            if (openParen > 0) {
                name = name.slice(0, openParen).trimEnd();
            }
        }
        return name;
    }
    buildBaseState(payload, gameType) {
        const status = payload.room.status || 'setup';
        const roomOwnerId = typeof payload?.room?.owner?.id === 'number'
            ? payload.room.owner.id
            : null;
        const roomWithRunId = payload.room;
        const runId = typeof roomWithRunId.runId === 'number' ? roomWithRunId.runId : null;
        const metadata = {
            roomId: payload?.room?.id ?? null,
            roomOwnerId,
            gameType,
            roomStartedAt: payload?.room?.startedAt ?? null,
            roomRunId: runId,
            generatedAt: new Date().toISOString(),
        };
        const rng = (0, seeded_rng_1.ensureSeededRng)(metadata);
        metadata.rng = rng;
        const playersBase = this.buildPlayers(payload);
        const players = this.shouldRandomizeStarter(status)
            ? this.shufflePlayers(playersBase, rng.seed)
            : playersBase;
        metadata.ownerPlayerId =
            roomOwnerId != null && players.some((p) => p?.id === roomOwnerId)
                ? roomOwnerId
                : (players[0]?.id ?? null);
        return {
            status,
            phase: 'playing',
            round: 1,
            turnIndex: 0,
            lastRoll: null,
            lastDraw: null,
            log: [],
            players,
            turn: {
                currentPlayerId: players[0]?.id ?? null,
                direction: 1,
            },
            metadata,
            botThinking: false,
        };
    }
    cloneState(state) {
        return {
            ...state,
            log: [...(state.log || [])],
            players: state.players ? [...state.players] : undefined,
            turn: state.turn ? { ...state.turn } : undefined,
            metadata: state.metadata ? { ...state.metadata } : undefined,
            pending: state.pending ? { ...state.pending } : state.pending,
        };
    }
    appendLog(state, message) {
        const normalizedMessage = (0, log_style_helper_1.normalizeGameLogMessage)(message);
        if (!normalizedMessage)
            return state;
        const lastMessage = state.log?.[state.log.length - 1]?.message ?? '';
        if (String(lastMessage) === normalizedMessage)
            return state;
        const entry = {
            message: normalizedMessage,
            timestamp: new Date().toISOString(),
        };
        const next = this.cloneState(state);
        next.log.push(entry);
        return next;
    }
    buildPlayers(payload) {
        const players = [];
        payload.room.players.forEach((p) => players.push({
            id: p.id,
            username: this.sanitizePlayerName(p.username),
            isBot: false,
            basket: [],
            inventory: [],
            shoppingList: [],
        }));
        payload.room.bots.forEach((b) => players.push({
            id: -Math.abs(b.id),
            username: this.sanitizePlayerName(b.name),
            isBot: true,
            basket: [],
            inventory: [],
            shoppingList: [],
        }));
        return players;
    }
    shouldRandomizeStarter(status) {
        return status.toLowerCase() === 'started';
    }
    shufflePlayers(players, seed) {
        return (0, seeded_shuffle_1.seededShuffle)(players, seed, 'game-core:starter');
    }
};
exports.GameCoreService = GameCoreService;
exports.GameCoreService = GameCoreService = __decorate([
    (0, common_1.Injectable)()
], GameCoreService);
//# sourceMappingURL=game-core.service.js.map