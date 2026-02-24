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
exports.PiratesEnVadrouilleActionService = void 0;
const common_1 = require("@nestjs/common");
const player_name_helper_1 = require("../../../../modules/turn-policies/player-name.helper");
const game_core_service_1 = require("../../../../core/services/game-core.service");
const random_service_1 = require("../../../../modules/random/services/random.service");
const turn_flow_service_1 = require("../../../../modules/turn/services/turn-flow.service");
const deck_policies_service_1 = require("../../../../modules/deck-policies/services/deck-policies.service");
const pending_action_service_1 = require("../../../../modules/pending-action/services/pending-action.service");
const action_service_helper_1 = require("../../../../actions/action-service.helper");
const pirate_card_effects_1 = require("./pirate-card-effects");
function asRecord(value) {
    return value != null && typeof value === 'object'
        ? value
        : {};
}
let PiratesEnVadrouilleActionService = class PiratesEnVadrouilleActionService {
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
        const playerId = state.turn?.currentPlayerId ?? null;
        if (playerId == null)
            return state;
        const meta = this.getMeta(state);
        const skip = meta.statuses.skipTurn?.[playerId] ?? 0;
        if (skip > 0) {
            const nextStatuses = {
                ...meta.statuses,
                skipTurn: {
                    ...(meta.statuses.skipTurn ?? {}),
                    [playerId]: Math.max(0, skip - 1),
                },
            };
            return this.turns.advanceTurn(this.core.appendLog({
                ...state,
                metadata: {
                    ...(state.metadata ?? {}),
                    ...meta,
                    statuses: nextStatuses,
                },
            }, `${(0, player_name_helper_1.resolvePlayerNameFromState)(state, playerId)} saute son tour (${skip} restant).`));
        }
        const rng = this.random.rollDice(meta, 6);
        const nextMeta = { ...meta, ...rng.meta };
        let next = {
            ...state,
            lastRoll: rng.roll,
            metadata: { ...(state.metadata ?? {}), ...nextMeta },
        };
        next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, playerId)} lance le dé : "${rng.roll}".`);
        next = this.move(next, playerId, rng.roll);
        next = this.applyLanding(next, playerId);
        const updatedMeta = this.getMeta(next);
        if (updatedMeta.winnerId != null) {
            return { ...next, status: 'finished' };
        }
        if (next.pending)
            return next;
        if (updatedMeta.keepTurn) {
            const metaCopy = { ...updatedMeta };
            delete metaCopy.keepTurn;
            next = {
                ...next,
                metadata: { ...(next.metadata ?? {}), ...metaCopy },
            };
            next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, playerId)} rejoue.`);
            return next;
        }
        return this.turns.advanceTurn(next);
    }
    handleChooseTarget(state, action) {
        if (String(state.status ?? '').toLowerCase() !== 'started')
            return state;
        const pending = state.pending;
        if (!pending || !(0, pending_action_service_1.isPendingType)(state, 'choose_target'))
            return state;
        const playerId = state.turn?.currentPlayerId ?? null;
        if (playerId == null)
            return state;
        const payload = asRecord(action.payload);
        const targetId = Number(payload.targetPlayerId);
        const pendingData = asRecord(pending.data);
        const optionsRaw = Array.isArray(pendingData.options)
            ? pendingData.options
            : [];
        const options = optionsRaw
            .map((entry) => {
            const row = asRecord(entry);
            return { targetPlayerId: Number(row.targetPlayerId) };
        })
            .filter((entry) => Number.isFinite(entry.targetPlayerId));
        if (!Number.isFinite(targetId) ||
            !options.some((opt) => opt.targetPlayerId === targetId)) {
            return state;
        }
        const meta = this.getMeta(state);
        const ctx = meta.pendingContext;
        if (!ctx || ctx.actorId !== playerId) {
            return (0, pending_action_service_1.clearPendingState)(state);
        }
        let next = this.applyTargetEffect(state, targetId, ctx);
        const updatedMeta = this.getMeta(next);
        next = {
            ...(0, pending_action_service_1.clearPendingState)(next),
            metadata: {
                ...(next.metadata ?? {}),
                ...updatedMeta,
                pendingContext: null,
            },
        };
        if (next.pending)
            return next;
        return this.turns.advanceTurn(next);
    }
    applyLanding(state, playerId) {
        let next = state;
        const meta = this.getMeta(next);
        const pos = meta.positions?.[playerId] ?? 0;
        const tile = meta.tiles[pos];
        if (!tile)
            return next;
        next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, playerId)} place ${this.pawnLabel(next, playerId)} en case ${tile.n} (${tile.title}).`);
        switch (tile.type) {
            case 'bonus':
                return this.drawCard(next, playerId, 'bonus');
            case 'treasure':
                return this.drawCard(next, playerId, 'treasure');
            case 'obstacle':
                return this.drawCard(next, playerId, 'obstacle');
            case 'gold':
                return this.collectGold(next, playerId);
            case 'finish':
                return this.handleFinish(next, playerId);
            default:
                return next;
        }
    }
    drawCard(state, playerId, deckName) {
        const meta = this.getMeta(state);
        const draw = this.drawFromDeck(meta, deckName);
        let next = {
            ...state,
            metadata: { ...(state.metadata ?? {}), ...draw.meta },
        };
        const card = draw.card;
        if (!card) {
            return this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, playerId)} n’a plus de cartes ${deckName}.`);
        }
        next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, playerId)} pioche la carte "${card.title}".`);
        next = this.addCardToCollection(next, playerId, deckName, card);
        if (deckName === 'treasure') {
            return next;
        }
        if (deckName === 'bonus') {
            return this.applyBonusCard(next, playerId, card);
        }
        return this.applyObstacleCard(next, playerId, card);
    }
    applyBonusCard(state, playerId, card) {
        let next = state;
        const effect = pirate_card_effects_1.BONUS_CARD_EFFECTS[card.id];
        if (!effect)
            return next;
        next = this.core.appendLog(next, this.formatActionMessage(next, effect, playerId));
        switch (effect.kind) {
            case 'move':
                return this.move(next, playerId, effect.delta);
            case 'immunity':
                return this.addImmunity(next, playerId, effect.turns);
            case 'reroll':
                return this.setKeepTurn(next);
            case 'targetMove':
            case 'stealTreasure':
                return this.promptTargetSelection(next, playerId, effect);
            case 'gainGold':
                return this.modifyGold(next, playerId, effect.amount);
            default:
                return next;
        }
    }
    applyObstacleCard(state, playerId, card) {
        let next = state;
        const meta = this.getMeta(next);
        const immunity = meta.statuses.obstacleImmunity?.[playerId] ?? 0;
        if (immunity > 0) {
            const nextStatuses = {
                ...meta.statuses,
                obstacleImmunity: {
                    ...(meta.statuses.obstacleImmunity ?? {}),
                    [playerId]: Math.max(0, immunity - 1),
                },
            };
            next = {
                ...next,
                metadata: { ...(next.metadata ?? {}), ...meta, statuses: nextStatuses },
            };
            return this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, playerId)} est protégé et ignore l'obstacle "${card.title}".`);
        }
        const effect = pirate_card_effects_1.OBSTACLE_CARD_EFFECTS[card.id];
        if (!effect)
            return next;
        next = this.core.appendLog(next, this.formatActionMessage(next, effect, playerId));
        switch (effect.kind) {
            case 'move':
                return this.move(next, playerId, effect.delta);
            case 'skip':
                return this.addSkip(next, playerId, effect.turns);
            case 'loseGold':
                return this.modifyGold(next, playerId, -effect.amount);
            default:
                return next;
        }
    }
    applyTargetEffect(state, targetPlayerId, ctx) {
        if (!ctx)
            return state;
        let next = state;
        if (ctx.kind === 'target_move' && ctx.actorId != null) {
            next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, ctx.actorId)} applique ${ctx.delta >= 0 ? 'un boost' : 'un ralentissement'} à ${(0, player_name_helper_1.resolvePlayerNameFromState)(next, targetPlayerId)} (${ctx.delta}).`);
            next = this.move(next, targetPlayerId, ctx.delta);
            return next;
        }
        if (ctx.kind === 'steal_treasure' && ctx.actorId != null) {
            const targetCollection = this.getCollection(next, targetPlayerId);
            const stolen = targetCollection.treasures.slice(-1)[0];
            if (!stolen) {
                return this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, ctx.actorId)} tente de voler un trésor mais ${(0, player_name_helper_1.resolvePlayerNameFromState)(next, targetPlayerId)} n'en possède pas.`);
            }
            const trimmed = targetCollection.treasures.slice(0, -1);
            next = this.setCollection(next, targetPlayerId, {
                ...targetCollection,
                treasures: trimmed,
            });
            next = this.addCardToCollection(next, ctx.actorId, 'treasure', stolen);
            return this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, ctx.actorId)} dérobe "${stolen.title}" à ${(0, player_name_helper_1.resolvePlayerNameFromState)(next, targetPlayerId)}.`);
        }
        return next;
    }
    promptTargetSelection(state, playerId, effect) {
        const players = Array.isArray(state.players) ? state.players : [];
        const targets = players
            .filter((p) => p?.id != null && p.id !== playerId)
            .map((p) => ({ targetPlayerId: p.id }));
        if (!targets.length)
            return state;
        const pending = {
            type: 'choose_target',
            playerId,
            blocking: true,
            label: 'Choisissez un joueur cible.',
            data: { options: targets },
        };
        const meta = this.getMeta(state);
        const pendingContext = effect.kind === 'targetMove'
            ? { kind: 'target_move', actorId: playerId, delta: effect.delta }
            : effect.kind === 'stealTreasure'
                ? { kind: 'steal_treasure', actorId: playerId, count: effect.count }
                : null;
        return {
            ...(0, pending_action_service_1.createPendingState)(state, pending),
            metadata: {
                ...(state.metadata ?? {}),
                ...meta,
                pendingContext,
            },
        };
    }
    collectGold(state, playerId) {
        return this.modifyGold(state, playerId, 1);
    }
    handleFinish(state, playerId) {
        const meta = this.getMeta(state);
        const collection = this.getCollection(state, playerId);
        if (collection.treasures.length >= 3 || collection.goldPieces >= 3) {
            const next = {
                ...state,
                metadata: { ...(state.metadata ?? {}), ...meta, winnerId: playerId },
                status: 'finished',
            };
            return this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, playerId)} ouvre le coffre légendaire et gagne la partie !`);
        }
        const next = this.core.appendLog(state, `${(0, player_name_helper_1.resolvePlayerNameFromState)(state, playerId)} n'a pas assez de trésors ou pièces d'or et recule de deux cases.`);
        return this.move(next, playerId, -2);
    }
    addCardToCollection(state, playerId, deck, card, force = false) {
        const collection = this.getCollection(state, playerId);
        const total = this.getTotalCards(collection);
        if (!force && total >= 5) {
            return this.core.appendLog(state, `${(0, player_name_helper_1.resolvePlayerNameFromState)(state, playerId)} a déjà cinq cartes et ne peut pas en ajouter.`);
        }
        const updated = { ...collection };
        if (deck === 'bonus') {
            updated.bonus = [...updated.bonus, card];
        }
        else if (deck === 'obstacle') {
            updated.obstacles = [
                ...updated.obstacles,
                card,
            ];
        }
        else if (deck === 'treasure') {
            updated.treasures = [
                ...updated.treasures,
                card,
            ];
        }
        return this.setCollection(state, playerId, updated);
    }
    setCollection(state, playerId, collection) {
        const meta = this.getMeta(state);
        const collections = { ...(meta.collections ?? {}), [playerId]: collection };
        return {
            ...state,
            metadata: { ...(state.metadata ?? {}), ...meta, collections },
        };
    }
    addSkip(state, playerId, turns) {
        const meta = this.getMeta(state);
        const current = meta.statuses.skipTurn?.[playerId] ?? 0;
        const statuses = {
            ...meta.statuses,
            skipTurn: {
                ...(meta.statuses.skipTurn ?? {}),
                [playerId]: current + turns,
            },
        };
        return {
            ...state,
            metadata: { ...(state.metadata ?? {}), ...meta, statuses },
        };
    }
    addImmunity(state, playerId, turns) {
        const meta = this.getMeta(state);
        const current = meta.statuses.obstacleImmunity?.[playerId] ?? 0;
        const statuses = {
            ...meta.statuses,
            obstacleImmunity: {
                ...(meta.statuses.obstacleImmunity ?? {}),
                [playerId]: current + turns,
            },
        };
        return {
            ...state,
            metadata: { ...(state.metadata ?? {}), ...meta, statuses },
        };
    }
    modifyGold(state, playerId, amount) {
        const collection = this.getCollection(state, playerId);
        const updated = {
            ...collection,
            goldPieces: Math.max(0, collection.goldPieces + amount),
        };
        return this.setCollection(state, playerId, updated);
    }
    setKeepTurn(state) {
        const meta = this.getMeta(state);
        const copy = { ...meta, keepTurn: true };
        return { ...state, metadata: { ...(state.metadata ?? {}), ...copy } };
    }
    drawFromDeck(meta, deck) {
        const draw = this.deckPolicies.drawFromPile({
            meta,
            pile: Array.isArray(meta.decks?.[deck]) ? meta.decks[deck] : [],
            discard: Array.isArray(meta.discards?.[deck]) ? meta.discards[deck] : [],
            useWholeMetaRng: true,
            discardDrawnCard: true,
        });
        const nextMeta = {
            ...draw.meta,
            decks: { ...draw.meta.decks, [deck]: draw.pile },
            discards: { ...draw.meta.discards, [deck]: draw.discard },
        };
        return { card: draw.card ?? null, meta: nextMeta };
    }
    formatActionMessage(state, effect, playerId) {
        const description = (() => {
            switch (effect.kind) {
                case 'move':
                    return effect.delta >= 0
                        ? `avance de ${effect.delta} cases`
                        : `recule de ${Math.abs(effect.delta)} cases`;
                case 'skip':
                    return `saute ${effect.turns} tour(s)`;
                case 'immunity':
                    return `est protégé contre ${effect.turns} obstacle(s)`;
                case 'gainGold':
                    return `gagne ${effect.amount} pièce(s) d'or`;
                case 'loseGold':
                    return `perd ${effect.amount} pièce(s) d'or`;
                case 'reroll':
                    return 'relance immédiatement le dé';
                case 'targetMove':
                    return `rétrograde un adversaire de ${Math.abs(effect.delta)} case(s)`;
                case 'stealTreasure':
                    return `tente de voler ${effect.count} trésor(s)`;
                default:
                    return 'applique un effet';
            }
        })();
        return `${(0, player_name_helper_1.resolvePlayerNameFromState)(state, playerId)} ${description}.`;
    }
    getCollection(state, playerId) {
        const meta = this.getMeta(state);
        const current = meta.collections?.[playerId];
        if (current)
            return current;
        return {
            treasures: [],
            obstacles: [],
            bonus: [],
            goldPieces: 0,
        };
    }
    getTotalCards(collection) {
        return ((collection.treasures?.length ?? 0) +
            (collection.obstacles?.length ?? 0) +
            (collection.bonus?.length ?? 0));
    }
    move(state, playerId, delta) {
        const meta = this.getMeta(state);
        const current = meta.positions?.[playerId] ?? 0;
        const nextPos = Math.max(0, Math.min(current + delta, (meta.tiles?.length ?? 1) - 1));
        return this.setPos(state, playerId, nextPos);
    }
    setPos(state, playerId, pos) {
        const meta = this.getMeta(state);
        const nextMeta = {
            ...meta,
            positions: { ...(meta.positions ?? {}), [playerId]: pos },
        };
        return { ...state, metadata: { ...(state.metadata ?? {}), ...nextMeta } };
    }
    pawnLabel(state, id) {
        const players = Array.isArray(state.players) ? state.players : [];
        const player = players.find((p) => p?.id === id) ?? null;
        const pawn = typeof player?.pawn === 'string' ? String(player.pawn).trim() : '';
        if (!pawn)
            return '"son pion"';
        const lower = pawn.toLowerCase();
        const feminine = lower.startsWith('la ') || lower.startsWith('une ');
        const inner = pawn
            .replace(/^l['’]\s*/i, '')
            .replace(/^(le|la|les|un|une)\s+/i, '')
            .trim();
        const core = inner || pawn;
        const lowered = core.length <= 1
            ? core.toLowerCase()
            : `${core.charAt(0).toLowerCase()}${core.slice(1)}`;
        return `"${feminine ? 'sa' : 'son'} ${lowered}"`;
    }
    getMeta(state) {
        return (state.metadata ?? {});
    }
};
exports.PiratesEnVadrouilleActionService = PiratesEnVadrouilleActionService;
exports.PiratesEnVadrouilleActionService = PiratesEnVadrouilleActionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [random_service_1.RandomService,
        turn_flow_service_1.TurnFlowService,
        game_core_service_1.GameCoreService,
        deck_policies_service_1.DeckPoliciesService])
], PiratesEnVadrouilleActionService);
//# sourceMappingURL=pirates-en-vadrouille-action.service.js.map