"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "MonVillageActionService", {
    enumerable: true,
    get: function() {
        return MonVillageActionService;
    }
});
const _common = require("@nestjs/common");
const _actionservicehelper = require("../../../../actions/action-service.helper");
const _playernamehelper = require("../../../../modules/turn-policies/player-name.helper");
const _gamecoreservice = require("../../../../core/services/game-core.service");
const _randomservice = require("../../../../modules/random/services/random.service");
const _turnflowservice = require("../../../../modules/turn/services/turn-flow.service");
const _deckpoliciesservice = require("../../../../modules/deck-policies/services/deck-policies.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
const ZONE_MAP = [
    {
        min: 1,
        max: 6,
        id: 1
    },
    {
        min: 7,
        max: 13,
        id: 2
    },
    {
        min: 14,
        max: 20,
        id: 3
    },
    {
        min: 21,
        max: 25,
        id: 4
    },
    {
        min: 26,
        max: 31,
        id: 5
    },
    {
        min: 32,
        max: 36,
        id: 6
    },
    {
        min: 37,
        max: 41,
        id: 7
    },
    {
        min: 42,
        max: 42,
        id: 8
    }
];
function asPartialMeta(value) {
    return value != null && typeof value === 'object' ? value : {};
}
function getZoneForTile(n) {
    const entry = ZONE_MAP.find((range)=>n >= range.min && n <= range.max);
    return entry?.id ?? null;
}
let MonVillageActionService = class MonVillageActionService {
    applyActions(state, actions) {
        const next = (0, _actionservicehelper.applyActionsSequentially)(state, actions, (next, action)=>{
            const type = (0, _actionservicehelper.normalizeActionType)(action);
            return (0, _actionservicehelper.dispatchByActionType)(type, {
                roll: ()=>{
                    next = this.handleRoll(next);
                    return next;
                }
            }, ()=>next);
        });
        return next;
    }
    handleRoll(state) {
        if (String(state.status ?? '').toLowerCase() !== 'started') return state;
        if (state.pending) return state;
        const playerId = state.turn?.currentPlayerId ?? null;
        if (playerId == null) return state;
        const meta = this.getMeta(state);
        const skip = meta.statuses?.skipTurn?.[playerId] ?? 0;
        if (skip > 0) {
            const nextStatuses = {
                ...meta.statuses,
                skipTurn: {
                    ...meta.statuses.skipTurn ?? {},
                    [playerId]: Math.max(0, skip - 1)
                }
            };
            return this.turns.advanceTurn(this.core.appendLog({
                ...state,
                metadata: {
                    ...state.metadata ?? {},
                    ...meta,
                    statuses: nextStatuses
                }
            }, `${(0, _playernamehelper.resolvePlayerNameFromState)(state, playerId)} saute son tour (${skip} restant).`));
        }
        const rng = this.random.rollDice(meta, 6);
        const nextMeta = {
            ...meta,
            ...asPartialMeta(rng.meta)
        };
        let next = {
            ...state,
            lastRoll: rng.roll,
            metadata: {
                ...state.metadata ?? {},
                ...nextMeta
            }
        };
        next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} lance le dé : "${rng.roll}".`);
        next = this.move(next, playerId, rng.roll);
        next = this.applyLanding(next, playerId);
        const updatedMeta = this.getMeta(next);
        if (updatedMeta.winnerId != null) return {
            ...next,
            status: 'finished'
        };
        if (next.pending) return next;
        return this.turns.advanceTurn(next);
    }
    applyLanding(state, playerId) {
        let next = state;
        const meta = this.getMeta(next);
        const pos = meta.positions?.[playerId] ?? 0;
        const tile = meta.tiles[pos];
        if (!tile) return next;
        next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} place ${this.pawnLabel(next, playerId)} en case ${tile.n} (${tile.title}).`);
        if (tile.type === 'finish') {
            return this.finishGame(next, playerId);
        }
        return this.collectCard(next, playerId, tile.n);
    }
    collectCard(state, playerId, tileNumber) {
        const zoneId = getZoneForTile(tileNumber);
        if (zoneId == null) return state;
        const meta = this.getMeta(state);
        const drawn = this.drawCard(meta, zoneId);
        let next = {
            ...state,
            metadata: {
                ...state.metadata ?? {},
                ...drawn.meta
            }
        };
        const card = drawn.card;
        if (!card) {
            return this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} n’a plus de cartes dans la zone ${zoneId}.`);
        }
        next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} collecte "${card.title}".`);
        next = this.updateCollections(next, playerId, card);
        return next;
    }
    updateCollections(state, playerId, card) {
        const meta = this.getMeta(state);
        const collections = {
            ...meta.collections ?? {}
        };
        const existing = collections[playerId] ?? {
            total: 0,
            byZone: {}
        };
        const zoneCount = (existing.byZone ?? {})[card.zoneId] ?? 0;
        const updated = {
            total: existing.total + 1,
            byZone: {
                ...existing.byZone ?? {},
                [card.zoneId]: zoneCount + 1
            }
        };
        collections[playerId] = updated;
        return {
            ...state,
            metadata: {
                ...state.metadata ?? {},
                ...meta,
                collections
            }
        };
    }
    finishGame(state, playerId) {
        const meta = this.getMeta(state);
        const entries = Object.entries(meta.collections ?? {}).map(([id, value])=>({
                id: Number(id),
                ...value
            }));
        let best = entries.filter((entry)=>Number.isFinite(entry.id)).sort((a, b)=>b.total - a.total)[0];
        if (!best) best = {
            id: playerId,
            total: 0,
            byZone: {}
        };
        const tied = entries.filter((entry)=>entry.total === best.total);
        if (tied.length > 1) {
            for (const zone of ZONE_MAP.map((range)=>range.id)){
                const zoneBest = tied.map((entry)=>({
                        id: entry.id,
                        count: entry.byZone?.[zone] ?? 0
                    })).sort((a, b)=>b.count - a.count)[0];
                if (zoneBest && zoneBest.count > 0) {
                    best = tied.find((entry)=>entry.id === zoneBest.id) ?? best;
                    if (tied.some((entry)=>entry.id !== best.id && (entry.byZone?.[zone] ?? 0) === zoneBest.count)) {
                        continue;
                    }
                    break;
                }
            }
        }
        const nextMeta = {
            ...meta,
            winnerId: best.id
        };
        let next = {
            ...state,
            status: 'finished',
            metadata: {
                ...state.metadata ?? {},
                ...nextMeta
            }
        };
        next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, best.id)} remporte la partie avec ${best.total} cartes !`);
        return next;
    }
    move(state, playerId, delta) {
        const meta = this.getMeta(state);
        const current = meta.positions?.[playerId] ?? 0;
        const nextPos = Math.max(0, Math.min(current + delta, (meta.tiles?.length ?? 1) - 1));
        return this.setPos(state, playerId, nextPos);
    }
    setPos(state, playerId, pos) {
        const meta = this.getMeta(state);
        const updated = {
            ...meta,
            positions: {
                ...meta.positions ?? {},
                [playerId]: pos
            }
        };
        return {
            ...state,
            metadata: {
                ...state.metadata ?? {},
                ...updated
            }
        };
    }
    drawCard(meta, zoneId) {
        const draw = this.deckPolicies.drawFromPile({
            meta,
            pile: Array.isArray(meta.decks?.[zoneId]) ? meta.decks[zoneId] : [],
            discard: Array.isArray(meta.discards?.[zoneId]) ? meta.discards[zoneId] : [],
            useWholeMetaRng: true,
            discardDrawnCard: true
        });
        const nextMeta = {
            ...draw.meta,
            decks: {
                ...draw.meta.decks,
                [zoneId]: draw.pile
            },
            discards: {
                ...draw.meta.discards,
                [zoneId]: draw.discard
            }
        };
        return {
            card: draw.card,
            meta: nextMeta
        };
    }
    getMeta(state) {
        return state.metadata ?? {};
    }
    pawnLabel(state, id) {
        const players = Array.isArray(state.players) ? state.players : [];
        const player = players.find((p)=>p?.id === id) ?? null;
        const pawn = typeof player?.pawn === 'string' ? String(player.pawn).trim() : '';
        if (!pawn) return '"son pion"';
        const lower = pawn.toLowerCase();
        const feminine = lower.startsWith('la ') || lower.startsWith('une ');
        const inner = pawn.replace(/^l['’]\s*/i, '').replace(/^(le|la|les|un|une)\s+/i, '').trim();
        const core = inner || pawn;
        const lowered = core.length <= 1 ? core.toLowerCase() : `${core.charAt(0).toLowerCase()}${core.slice(1)}`;
        return `"${feminine ? 'sa' : 'son'} ${lowered}"`;
    }
    constructor(random, turns, core, deckPolicies){
        this.random = random;
        this.turns = turns;
        this.core = core;
        this.deckPolicies = deckPolicies;
    }
};
MonVillageActionService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _randomservice.RandomService === "undefined" ? Object : _randomservice.RandomService,
        typeof _turnflowservice.TurnFlowService === "undefined" ? Object : _turnflowservice.TurnFlowService,
        typeof _gamecoreservice.GameCoreService === "undefined" ? Object : _gamecoreservice.GameCoreService,
        typeof _deckpoliciesservice.DeckPoliciesService === "undefined" ? Object : _deckpoliciesservice.DeckPoliciesService
    ])
], MonVillageActionService);
