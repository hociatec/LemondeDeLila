"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "GameCoreService", {
    enumerable: true,
    get: function() {
        return GameCoreService;
    }
});
const _common = require("@nestjs/common");
const _seededrng = require("../../../common/utils/seeded-rng");
const _seededshuffle = require("../../../common/utils/seeded-shuffle");
const _logstylehelper = require("../helpers/log-style.helper");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function toPlayerNameText(raw) {
    if (typeof raw === 'string') return raw;
    if (typeof raw === 'number' || typeof raw === 'boolean') {
        return String(raw);
    }
    return '';
}
function normalizePromptToken(value) {
    return String(value ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}
function extractPawnPromptToken(message) {
    const text = String(message ?? '').trim();
    if (!text) return null;
    const normalized = normalizePromptToken(text);
    if (normalized.includes('choisissez votre pion')) {
        return 'prompt:choose-your-pawn';
    }
    const withPlayer = /^c['’]est à (.+?) de choisir son pion(?:[.,!?]|$)/i.exec(text);
    if (withPlayer) {
        return `prompt:choose-pawn:${normalizePromptToken(withPlayer[1])}`;
    }
    return null;
}
let GameCoreService = class GameCoreService {
    sanitizePlayerName(raw) {
        let name = toPlayerNameText(raw).trim();
        name = name.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
        if (name.startsWith('"') && name.endsWith('"')) {
            name = name.slice(1, -1).trim();
        }
        const lowered = name.toLowerCase();
        if (lowered.endsWith('(zone de jeu)') || lowered.endsWith('(zone de jeux)') || lowered.endsWith('(game zone)')) {
            const openParen = name.lastIndexOf('(');
            if (openParen > 0) {
                name = name.slice(0, openParen).trimEnd();
            }
        }
        return name;
    }
    buildBaseState(payload, gameType) {
        const status = payload.room.status || 'setup';
        const roomOwnerId = typeof payload?.room?.owner?.id === 'number' ? payload.room.owner.id : null;
        const roomWithRunId = payload.room;
        const runId = typeof roomWithRunId.runId === 'number' ? roomWithRunId.runId : null;
        const metadata = {
            roomId: payload?.room?.id ?? null,
            roomOwnerId,
            gameType,
            roomStartedAt: payload?.room?.startedAt ?? null,
            roomRunId: runId,
            generatedAt: new Date().toISOString()
        };
        const rng = (0, _seededrng.ensureSeededRng)(metadata);
        metadata.rng = rng;
        const playersBase = this.buildPlayers(payload);
        const players = this.shouldRandomizeStarter(status) ? this.shufflePlayers(playersBase, rng.seed) : playersBase;
        // ownerPlayerId: identifiant du "propriétaire de la table" (par id joueur).
        // Important: ne pas l'utiliser pour la seed RNG (donc le calculer après ensureSeededRng).
        metadata.ownerPlayerId = roomOwnerId != null && players.some((p)=>p?.id === roomOwnerId) ? roomOwnerId : players[0]?.id ?? null;
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
                direction: 1
            },
            metadata,
            botThinking: false
        };
    }
    cloneState(state) {
        return {
            ...state,
            log: [
                ...state.log || []
            ],
            players: state.players ? [
                ...state.players
            ] : undefined,
            turn: state.turn ? {
                ...state.turn
            } : undefined,
            metadata: state.metadata ? {
                ...state.metadata
            } : undefined,
            pending: state.pending ? {
                ...state.pending
            } : state.pending
        };
    }
    appendLog(state, message) {
        const normalizedMessage = (0, _logstylehelper.normalizeGameLogMessage)(message);
        if (!normalizedMessage) return state;
        const nextPromptToken = extractPawnPromptToken(normalizedMessage);
        if (nextPromptToken) {
            const log = Array.isArray(state.log) ? state.log : [];
            const recent = log.slice(-6);
            const hasSamePrompt = recent.some((entry)=>{
                const existingToken = extractPawnPromptToken(String(entry?.message ?? ''));
                return existingToken != null && existingToken === nextPromptToken;
            });
            if (hasSamePrompt) return state;
        }
        const lastMessage = state.log?.[state.log.length - 1]?.message ?? '';
        if (String(lastMessage) === normalizedMessage) return state;
        const entry = {
            message: normalizedMessage,
            timestamp: new Date().toISOString()
        };
        const next = this.cloneState(state);
        next.log.push(entry);
        return next;
    }
    buildPlayers(payload) {
        const players = [];
        payload.room.players.forEach((p)=>players.push({
                id: p.id,
                username: this.sanitizePlayerName(p.username),
                isBot: false,
                basket: [],
                inventory: [],
                shoppingList: []
            }));
        payload.room.bots.forEach((b)=>players.push({
                // Stable id: avoid shifting bot ids when the room bot list order changes.
                // This prevents games from "remembering" a different bot after add/remove/reorder.
                id: -Math.abs(b.id),
                username: this.sanitizePlayerName(b.name),
                isBot: true,
                basket: [],
                inventory: [],
                shoppingList: []
            }));
        return players;
    }
    shouldRandomizeStarter(status) {
        return status.toLowerCase() === 'started';
    }
    shufflePlayers(players, seed) {
        return (0, _seededshuffle.seededShuffle)(players, seed, 'game-core:starter');
    }
};
GameCoreService = _ts_decorate([
    (0, _common.Injectable)()
], GameCoreService);
