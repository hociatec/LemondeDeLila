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
exports.PrimalisActionService = void 0;
const common_1 = require("@nestjs/common");
const player_name_helper_1 = require("../../../../modules/turn-policies/player-name.helper");
const game_core_service_1 = require("../../../../core/services/game-core.service");
const random_service_1 = require("../../../../modules/random/services/random.service");
const turn_flow_service_1 = require("../../../../modules/turn/services/turn-flow.service");
const action_service_helper_1 = require("../../../../actions/action-service.helper");
function asPartialMeta(value) {
    return value != null && typeof value === 'object'
        ? value
        : {};
}
let PrimalisActionService = class PrimalisActionService {
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
            }, () => next);
        });
        return next;
    }
    handleRoll(state) {
        if (String(state.status ?? '').toLowerCase() !== 'started')
            return state;
        const playerId = state.turn?.currentPlayerId ?? null;
        if (playerId == null)
            return state;
        if (state.pending)
            return state;
        const meta = this.getMeta(state);
        const rng = this.random.rollDice(meta, 6);
        let face = this.mapFace(rng.roll);
        let nextMeta = { ...meta, ...asPartialMeta(rng.meta) };
        let next = {
            ...state,
            lastRoll: rng.roll,
            metadata: { ...(state.metadata ?? {}), ...nextMeta },
        };
        next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, playerId)} lance le dé : "${rng.roll}".`);
        if (face === 'relance') {
            const reroll = this.random.rollDice(nextMeta, 6);
            face = this.mapFace(reroll.roll);
            nextMeta = { ...nextMeta, ...asPartialMeta(reroll.meta) };
            next = {
                ...next,
                lastRoll: reroll.roll,
                metadata: { ...(next.metadata ?? {}), ...nextMeta },
            };
            next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, playerId)} utilise la relance et obtient "${reroll.roll}".`);
        }
        next = this.applyFaceEffect(next, playerId, face);
        next = this.advancePlayer(next, playerId);
        next = this.checkFinish(next);
        const tile = this.getTileForPlayer(next, playerId);
        next = this.applyTileEffects(next, playerId, tile, face);
        if (face === 'danger') {
            next = this.applyDanger(next, playerId, tile);
            next = this.checkFinish(next);
        }
        const updatedMeta = this.getMeta(next);
        if (updatedMeta.winnerId != null) {
            return { ...next, status: 'finished' };
        }
        return this.turns.advanceTurn(next);
    }
    applyFaceEffect(state, playerId, face) {
        if (face === 'danger' || face === 'relance') {
            return state;
        }
        if (face === 'egg') {
            const resources = this.getResources(state, playerId);
            return this.addResources(state, playerId, this.determineDuplicate(resources));
        }
        const resource = face === 'herbivore'
            ? { herbivores: 1 }
            : face === 'carnivore'
                ? { carnivores: 1 }
                : face === 'leaf'
                    ? { leaves: 1 }
                    : null;
        if (!resource)
            return state;
        return this.addResources(state, playerId, resource);
    }
    applyTileEffects(state, playerId, tile, face) {
        if (!tile)
            return state;
        let next = state;
        const resources = this.getResources(next, playerId);
        switch (tile.n) {
            case 1:
                if (face === 'egg' || face === 'leaf') {
                    const addition = face === 'egg' ? { eggs: 1 } : { leaves: 1 };
                    next = this.addResources(next, playerId, addition);
                    next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, playerId)} double sa récolte sur la case 1.`);
                }
                break;
            case 2:
                if (resources.carnivores > resources.herbivores) {
                    next = this.addResources(next, playerId, { herbivores: -1 });
                    next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, playerId)} perd un herbivore (case 2).`);
                }
                break;
            case 3:
                if (face === 'leaf') {
                    next = this.addResources(next, playerId, { leaves: 1 });
                    next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, playerId)} gagne une feuille supplémentaire (case 3).`);
                }
                break;
            case 4:
                if (face === 'carnivore') {
                    next = this.addResources(next, playerId, { eggs: 1 });
                    next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, playerId)} récupère un œuf bonus (case 4).`);
                }
                break;
            case 6:
                next = this.enableDangerAmplification(next);
                break;
            case 7:
                next = this.addResources(next, playerId, { leaves: 1 });
                next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, playerId)} collecte une feuille magique (case 7).`);
                break;
            case 8:
                if (face === 'herbivore' || face === 'carnivore') {
                    next = this.addResources(next, playerId, { leaves: 1 });
                    next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, playerId)} transforme sa relance en feuilles (case 8).`);
                }
                break;
            case 9:
                break;
            default:
        }
        return next;
    }
    applyDanger(state, playerId, tile) {
        let next = state;
        next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, playerId)} déclenche un Danger : la comète avance.`);
        next = this.advanceAllPlayers(next, 1);
        if (this.getMeta(next).statuses.dangerAmplified) {
            next = this.core.appendLog(next, 'La case 6 amplifie le Danger : tout le monde avance encore.');
            next = this.advanceAllPlayers(next, 1);
            next = this.disableDangerAmplification(next);
        }
        if (tile?.n === 9) {
            next = this.core.appendLog(next, 'Case 9 : le Danger est amplifié, tout le monde avance de deux cases supplémentaires.');
            next = this.advanceAllPlayers(next, 1);
        }
        return next;
    }
    advancePlayer(state, playerId) {
        const meta = this.getMeta(state);
        const current = meta.positions?.[playerId] ?? 0;
        const tiles = meta.tiles ?? [];
        const nextPos = Math.min(tiles.length ? tiles[tiles.length - 1].n : 0, current + 1);
        return this.setPosition(state, playerId, nextPos);
    }
    advanceAllPlayers(state, delta) {
        let next = state;
        const meta = this.getMeta(next);
        const tiles = meta.tiles ?? [];
        const maxPos = tiles.length ? tiles[tiles.length - 1].n : 0;
        const positions = { ...(meta.positions ?? {}) };
        for (const key of Object.keys(positions)) {
            const id = Number(key);
            if (!Number.isFinite(id))
                continue;
            const current = positions[id] ?? 0;
            positions[id] = Math.min(maxPos, current + delta);
        }
        next = {
            ...next,
            metadata: { ...(next.metadata ?? {}), ...meta, positions },
        };
        return next;
    }
    addResources(state, playerId, adjustments) {
        const meta = this.getMeta(state);
        const resources = this.getResources(state, playerId);
        const updated = {
            herbivores: Math.max(0, resources.herbivores + (adjustments.herbivores ?? 0)),
            carnivores: Math.max(0, resources.carnivores + (adjustments.carnivores ?? 0)),
            eggs: Math.max(0, resources.eggs + (adjustments.eggs ?? 0)),
            leaves: Math.max(0, resources.leaves + (adjustments.leaves ?? 0)),
        };
        const collections = { ...(meta.collections ?? {}), [playerId]: updated };
        return {
            ...state,
            metadata: { ...(state.metadata ?? {}), ...meta, collections },
        };
    }
    finishGame(state) {
        const meta = this.getMeta(state);
        const entries = Object.entries(meta.collections ?? {}).map(([id, resources]) => ({
            id: Number(id),
            resources,
        }));
        let best = entries[0];
        for (const entry of entries) {
            if (!best) {
                best = entry;
                continue;
            }
            const score = this.computeScore(entry.resources);
            const bestScore = this.computeScore(best.resources);
            if (score > bestScore) {
                best = entry;
            }
            else if (score === bestScore) {
                if ((entry.resources.leaves ?? 0) > (best.resources.leaves ?? 0)) {
                    best = entry;
                }
                else if (entry.resources.leaves === best.resources.leaves &&
                    (entry.resources.eggs ?? 0) > (best.resources.eggs ?? 0)) {
                    best = entry;
                }
            }
        }
        if (!best) {
            return state;
        }
        const next = {
            ...state,
            metadata: {
                ...(state.metadata ?? {}),
                ...meta,
                winnerId: best.id,
            },
            status: 'finished',
        };
        return this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, best.id)} survit à la comète avec ${best.resources.herbivores + best.resources.carnivores} dinosaures et ${best.resources.leaves} feuilles.`);
    }
    mapFace(value) {
        switch (value) {
            case 1:
                return 'herbivore';
            case 2:
                return 'carnivore';
            case 3:
                return 'egg';
            case 4:
                return 'leaf';
            case 5:
                return 'danger';
            case 6:
                return 'relance';
            default:
                return 'herbivore';
        }
    }
    setPosition(state, playerId, pos) {
        const meta = this.getMeta(state);
        const positions = { ...(meta.positions ?? {}), [playerId]: pos };
        const nextMeta = { ...meta, positions };
        return { ...state, metadata: { ...nextMeta } };
    }
    getTileForPlayer(state, playerId) {
        const meta = this.getMeta(state);
        const pos = meta.positions?.[playerId] ?? 0;
        return meta.tiles?.find((tile) => tile.n === pos) ?? null;
    }
    getResources(state, playerId) {
        const meta = this.getMeta(state);
        const resources = meta.collections?.[playerId];
        return resources ?? { herbivores: 0, carnivores: 0, eggs: 0, leaves: 0 };
    }
    determineDuplicate(resources) {
        if (resources.herbivores >= resources.carnivores) {
            return { herbivores: 1 };
        }
        return { carnivores: 1 };
    }
    enableDangerAmplification(state) {
        const meta = this.getMeta(state);
        const statuses = { ...meta.statuses, dangerAmplified: true };
        return {
            ...state,
            metadata: { ...(state.metadata ?? {}), ...meta, statuses },
        };
    }
    disableDangerAmplification(state) {
        const meta = this.getMeta(state);
        const statuses = { ...meta.statuses, dangerAmplified: false };
        return {
            ...state,
            metadata: { ...(state.metadata ?? {}), ...meta, statuses },
        };
    }
    computeScore(resources) {
        return resources.herbivores + resources.carnivores + resources.leaves;
    }
    getMeta(state) {
        return (state.metadata ?? {});
    }
    checkFinish(state) {
        const meta = this.getMeta(state);
        const tiles = meta.tiles ?? [];
        if (!tiles.length)
            return state;
        const last = tiles[tiles.length - 1].n;
        for (const player of state.players ?? []) {
            if (!player?.id)
                continue;
            const pos = meta.positions?.[player.id] ?? 0;
            if (pos >= last) {
                return this.finishGame(state);
            }
        }
        return state;
    }
};
exports.PrimalisActionService = PrimalisActionService;
exports.PrimalisActionService = PrimalisActionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [random_service_1.RandomService,
        turn_flow_service_1.TurnFlowService,
        game_core_service_1.GameCoreService])
], PrimalisActionService);
//# sourceMappingURL=primalis-action.service.js.map