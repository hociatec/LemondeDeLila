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
var ToutPresDeMamanActionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToutPresDeMamanActionService = void 0;
const common_1 = require("@nestjs/common");
const player_name_helper_1 = require("../../../../modules/turn-policies/player-name.helper");
const game_core_service_1 = require("../../../../core/services/game-core.service");
const random_service_1 = require("../../../../modules/random/services/random.service");
const turn_flow_service_1 = require("../../../../modules/turn/services/turn-flow.service");
const deck_policies_service_1 = require("../../../../modules/deck-policies/services/deck-policies.service");
const action_service_helper_1 = require("../../../../actions/action-service.helper");
let ToutPresDeMamanActionService = class ToutPresDeMamanActionService {
    static { ToutPresDeMamanActionService_1 = this; }
    core;
    random;
    turns;
    deckPolicies;
    static TOKENS_TO_WIN = 3;
    static MAX_DEPTH = 12;
    constructor(core, random, turns, deckPolicies) {
        this.core = core;
        this.random = random;
        this.turns = turns;
        this.deckPolicies = deckPolicies;
    }
    applyActions(state, actions) {
        const next = (0, action_service_helper_1.applyActionsSequentially)(state, actions, (next, action) => {
            const type = (0, action_service_helper_1.normalizeLowerActionType)(action);
            return (0, action_service_helper_1.dispatchByActionType)(type, {
                roll: () => {
                    next = this.handleRoll(next);
                    return next;
                },
                'roll dice': () => {
                    next = this.handleRoll(next);
                    return next;
                },
            }, () => next);
        });
        return next;
    }
    handleRoll(state) {
        const status = String(state.status ?? '').toLowerCase();
        if (status !== 'started')
            return state;
        if (state.pending)
            return state;
        const playerId = state.turn?.currentPlayerId ?? null;
        if (playerId == null)
            return state;
        const meta = this.getMeta(state);
        const skip = meta.statuses.skipTurn?.[playerId] ?? 0;
        if (skip > 0) {
            const updatedMeta = {
                ...meta,
                statuses: {
                    ...meta.statuses,
                    skipTurn: {
                        ...(meta.statuses?.skipTurn ?? {}),
                        [playerId]: skip - 1,
                    },
                },
            };
            const next = this.replaceMeta(state, updatedMeta);
            return this.turns.advanceTurn(this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, playerId)} reste sur place (tour sauté).`));
        }
        let nextMeta = { ...meta };
        const roll1 = this.random.rollDice(nextMeta, 6);
        nextMeta = { ...nextMeta, ...roll1.meta };
        let total = roll1.roll;
        const hasBonus = Boolean(nextMeta.statuses?.bonusReroll?.[playerId]);
        if (hasBonus) {
            nextMeta.statuses = {
                ...nextMeta.statuses,
                bonusReroll: {
                    ...(nextMeta.statuses?.bonusReroll ?? {}),
                    [playerId]: false,
                },
            };
            const reroll = this.random.rollDice(nextMeta, 6);
            nextMeta = { ...nextMeta, ...reroll.meta };
            total += reroll.roll;
        }
        let next = this.replaceMeta(state, nextMeta);
        next = {
            ...next,
            lastRoll: total,
        };
        const positions = nextMeta.positions ?? {};
        const startIndex = positions[playerId] ?? 0;
        const finishIndex = (nextMeta.tiles?.length ?? 1) - 1;
        let target = startIndex + total;
        if (target > finishIndex) {
            const over = target - finishIndex;
            target = Math.max(0, finishIndex - over);
        }
        next = this.setPlayerPosition(next, playerId, target);
        const tile = this.getTileByIndex(this.getMeta(next), target);
        next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, playerId)} avance de ${total} case(s) et place ${this.pawnLabel(next, playerId)} en case ${target + 1} (${tile?.title ?? `case ${target + 1}`}).`);
        next = this.applyTileEffects(next, playerId, target, 0);
        if ((next.status ?? '').toLowerCase() === 'finished') {
            return next;
        }
        return this.turns.advanceTurn(next);
    }
    applyTileEffects(state, playerId, index, depth) {
        if (depth > ToutPresDeMamanActionService_1.MAX_DEPTH) {
            return state;
        }
        const meta = this.getMeta(state);
        const tile = this.getTileByIndex(meta, index);
        if (!tile)
            return state;
        let next = state;
        switch (tile.type) {
            case 'start':
                next = this.gainTokens(next, playerId, 2);
                break;
            case 'token':
                next = this.gainTokens(next, playerId, 1);
                break;
            case 'card':
                next = this.drawAndApplyCard(next, playerId, depth + 1);
                break;
            case 'bonds':
                return this.moveAndApply(next, playerId, 2, depth + 1);
            case 'slide':
                return this.moveAndApply(next, playerId, -2, depth + 1);
            case 'storm':
            case 'nest':
                return this.addSkip(next, playerId, 1, tile);
            case 'meeting':
                return this.handleMeeting(next, playerId, depth + 1);
            case 'finish':
                return this.handleFinish(next, playerId, index, depth + 1);
            default:
                break;
        }
        return next;
    }
    drawAndApplyCard(state, playerId, depth) {
        const draw = this.drawCard(state);
        let next = draw.state;
        const card = draw.card;
        if (!card) {
            return this.core.appendLog(next, 'Aucune carte disponible pour le moment.');
        }
        next = this.core.appendLog(next, `Carte : ${card.text}`);
        return this.applyCardEffect(next, playerId, card, depth);
    }
    applyCardEffect(state, playerId, card, depth) {
        if (depth > ToutPresDeMamanActionService_1.MAX_DEPTH) {
            return state;
        }
        switch (card.id) {
            case 1:
                return this.moveAndApply(state, playerId, 1, depth + 1);
            case 2:
                return this.moveAndApply(state, playerId, -1, depth + 1);
            case 3:
                return this.gainTokens(state, playerId, 1);
            case 4:
                return this.moveAndApply(state, playerId, 2, depth + 1);
            case 5:
                return this.addSkip(state, playerId, 1, card);
            case 6:
                return this.moveAndApply(state, playerId, -2, depth + 1);
            case 7:
                return this.moveToNextType(state, playerId, 'card', depth + 1);
            case 8:
                return this.transferToken(state, playerId);
            case 9:
                return this.moveToPreviousType(state, playerId, 'token', depth + 1);
            case 10:
                return this.moveAllPlayers(state, -1, depth + 1);
            case 11:
                return this.setBonusReroll(state, playerId);
            case 12:
                return this.gainTokens(state, playerId, 1);
            case 13:
                return this.addSkip(state, playerId, 1, card);
            case 14:
                return this.moveAndApply(state, playerId, 3, depth + 1);
            case 15:
                return this.moveToPreviousType(state, playerId, 'bonds', depth + 1);
            case 16:
                return this.rollAndAdvance(state, playerId, depth + 1);
            case 17:
                return this.moveAndApply(state, playerId, -1, depth + 1);
            case 18:
                return this.moveAndApply(state, playerId, 2, depth + 1);
            case 19:
                return this.moveAndApply(state, playerId, -2, depth + 1);
            case 20:
                return this.gainTokens(state, playerId, 1);
            case 21:
                return this.moveAllPlayers(state, 1, depth + 1);
            case 22:
                return this.addSkip(state, playerId, 1, card);
            case 23:
                return this.rollAndMaybeAdvance(state, playerId, depth + 1);
            case 24:
                return this.moveToNextType(state, playerId, 'bonds', depth + 1);
            case 25:
                return this.loseToken(state, playerId);
            case 26:
                return this.shareAdvance(state, playerId, depth + 1);
            case 27:
                return state;
            case 28:
                return this.addSkip(state, playerId, 1, card);
            case 29: {
                const afterMove = this.moveAndApply(state, playerId, 2, depth + 1);
                return this.gainTokens(afterMove, playerId, 1);
            }
            case 30:
                return this.moveAndApply(state, playerId, 1, depth + 1);
            default:
                return state;
        }
    }
    handleMeeting(state, playerId, depth) {
        const meta = this.getMeta(state);
        const pos = meta.positions?.[playerId] ?? 0;
        const others = (state.players ?? [])
            .filter((p) => p?.id != null && p.id !== playerId)
            .filter((p) => (meta.positions?.[p.id ?? 0] ?? -1) === pos);
        let next = state;
        if (others.length) {
            next = this.core.appendLog(next, `Rencontre : ${(0, player_name_helper_1.resolvePlayerNameFromState)(next, playerId)} avance avec ses amis.`);
            for (const other of others) {
                next = this.moveAndApply(next, other.id, 1, depth + 1);
            }
        }
        return next;
    }
    handleFinish(state, playerId, index, depth) {
        const meta = this.getMeta(state);
        const tokens = meta.tokens?.[playerId] ?? 0;
        if (tokens >= ToutPresDeMamanActionService_1.TOKENS_TO_WIN) {
            let next = this.setWinner(state, playerId);
            next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, playerId)} retrouve maman avec ${tokens} jetons eucalyptus !`);
            return next;
        }
        const deficit = ToutPresDeMamanActionService_1.TOKENS_TO_WIN - tokens;
        const rewind = Math.min(index, deficit);
        const newIndex = Math.max(0, index - rewind);
        const next = this.core.appendLog(state, `${(0, player_name_helper_1.resolvePlayerNameFromState)(state, playerId)} manque de jetons et recule de ${rewind} case(s) pour en retrouver.`);
        const reposition = this.setPlayerPosition(next, playerId, newIndex);
        return this.applyTileEffects(reposition, playerId, this.getPlayerPosition(reposition, playerId), depth + 1);
    }
    setWinner(state, playerId) {
        const meta = this.getMeta(state);
        const updatedMeta = {
            ...meta,
            winnerId: playerId,
        };
        return {
            ...state,
            status: 'finished',
            metadata: { ...(state.metadata ?? {}), ...updatedMeta },
        };
    }
    moveAndApply(state, playerId, delta, depth) {
        if (delta === 0)
            return state;
        const meta = this.getMeta(state);
        const current = meta.positions?.[playerId] ?? 0;
        const target = Math.max(0, Math.min((meta.tiles?.length ?? 1) - 1, current + delta));
        const next = this.setPlayerPosition(state, playerId, target);
        return this.applyTileEffects(next, playerId, target, depth);
    }
    setPlayerPosition(state, playerId, index) {
        const meta = this.getMeta(state);
        const updatedPositions = {
            ...(meta.positions ?? {}),
            [playerId]: index,
        };
        const updatedMeta = {
            ...meta,
            positions: updatedPositions,
        };
        return this.replaceMeta(state, updatedMeta);
    }
    gainTokens(state, playerId, amount) {
        const meta = this.getMeta(state);
        const current = meta.tokens?.[playerId] ?? 0;
        const updatedMeta = {
            ...meta,
            tokens: {
                ...(meta.tokens ?? {}),
                [playerId]: current + amount,
            },
        };
        const next = this.replaceMeta(state, updatedMeta);
        return this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, playerId)} gagne ${amount} jeton(s) eucalyptus.`);
    }
    loseToken(state, playerId) {
        const meta = this.getMeta(state);
        const current = meta.tokens?.[playerId] ?? 0;
        if (current <= 0) {
            return this.core.appendLog(state, `${(0, player_name_helper_1.resolvePlayerNameFromState)(state, playerId)} n’a pas de jeton à perdre.`);
        }
        const updatedMeta = {
            ...meta,
            tokens: {
                ...(meta.tokens ?? {}),
                [playerId]: current - 1,
            },
        };
        const next = this.replaceMeta(state, updatedMeta);
        return this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, playerId)} perd un jeton eucalyptus.`);
    }
    addSkip(state, playerId, amount, tileOrCard) {
        const meta = this.getMeta(state);
        const current = meta.statuses.skipTurn?.[playerId] ?? 0;
        const updatedMeta = {
            ...meta,
            statuses: {
                ...meta.statuses,
                skipTurn: {
                    ...(meta.statuses?.skipTurn ?? {}),
                    [playerId]: current + amount,
                },
            },
        };
        const next = this.replaceMeta(state, updatedMeta);
        const label = 'text' in tileOrCard
            ? `carte ${tileOrCard.id}`
            : (tileOrCard?.title ?? 'effet spécial');
        return this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, playerId)} perd ${amount} tour(s) (${label}).`);
    }
    setBonusReroll(state, playerId) {
        const meta = this.getMeta(state);
        const updatedMeta = {
            ...meta,
            statuses: {
                ...meta.statuses,
                bonusReroll: {
                    ...(meta.statuses?.bonusReroll ?? {}),
                    [playerId]: true,
                },
            },
        };
        const next = this.replaceMeta(state, updatedMeta);
        return this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, playerId)} pourra relancer le dé au prochain tour.`);
    }
    moveAllPlayers(state, delta, depth) {
        let next = state;
        for (const player of state.players ?? []) {
            if (!player?.id)
                continue;
            next = this.moveAndApply(next, player.id, delta, depth + 1);
        }
        return next;
    }
    moveToNextType(state, playerId, type, depth) {
        const meta = this.getMeta(state);
        const current = meta.positions?.[playerId] ?? 0;
        const tiles = meta.tiles ?? [];
        for (let idx = current + 1; idx < tiles.length; idx += 1) {
            if (tiles[idx]?.type === type) {
                const next = this.setPlayerPosition(state, playerId, idx);
                return this.applyTileEffects(next, playerId, idx, depth);
            }
        }
        return state;
    }
    moveToPreviousType(state, playerId, type, depth) {
        const meta = this.getMeta(state);
        const current = meta.positions?.[playerId] ?? 0;
        const tiles = meta.tiles ?? [];
        for (let idx = current - 1; idx >= 0; idx -= 1) {
            if (tiles[idx]?.type === type) {
                const next = this.setPlayerPosition(state, playerId, idx);
                return this.applyTileEffects(next, playerId, idx, depth);
            }
        }
        return state;
    }
    transferToken(state, playerId) {
        const targetId = this.pickOtherPlayer(state, playerId);
        const meta = this.getMeta(state);
        const current = meta.tokens?.[playerId] ?? 0;
        if (!targetId || current <= 0) {
            return state;
        }
        const other = meta.tokens?.[targetId] ?? 0;
        const updatedMeta = {
            ...meta,
            tokens: {
                ...(meta.tokens ?? {}),
                [playerId]: current - 1,
                [targetId]: other + 1,
            },
        };
        const next = this.replaceMeta(state, updatedMeta);
        return this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, playerId)} partage un jeton avec ${(0, player_name_helper_1.resolvePlayerNameFromState)(next, targetId)}.`);
    }
    shareAdvance(state, playerId, depth) {
        let next = this.moveAndApply(state, playerId, 1, depth);
        const partnerId = this.pickOtherPlayer(state, playerId);
        if (partnerId) {
            next = this.moveAndApply(next, partnerId, 1, depth);
        }
        return next;
    }
    rollAndAdvance(state, playerId, depth) {
        const meta = this.getMeta(state);
        const roll = this.random.rollDice(meta, 6);
        const nextMeta = { ...meta, ...roll.meta };
        let next = this.replaceMeta(state, nextMeta);
        next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, playerId)} relance le dé et avance de ${roll.roll}.`);
        return this.moveAndApply(next, playerId, roll.roll, depth);
    }
    rollAndMaybeAdvance(state, playerId, depth) {
        const meta = this.getMeta(state);
        const roll = this.random.rollDice(meta, 6);
        let next = this.replaceMeta(state, { ...meta, ...roll.meta });
        next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, playerId)} fait ${roll.roll} au dé.`);
        if (roll.roll >= 4) {
            next = this.core.appendLog(next, `${(0, player_name_helper_1.resolvePlayerNameFromState)(next, playerId)} avance d’une case grâce à la réussite.`);
            return this.moveAndApply(next, playerId, 1, depth);
        }
        return next;
    }
    drawCard(state) {
        const meta = this.getMeta(state);
        const draw = this.deckPolicies.drawFromPile({
            meta,
            pile: Array.isArray(meta.deckCards) ? meta.deckCards : [],
            discard: Array.isArray(meta.discardCards) ? meta.discardCards : [],
            useWholeMetaRng: true,
            discardDrawnCard: true,
        });
        const nextMeta = {
            ...draw.meta,
            deckCards: draw.pile,
            discardCards: draw.discard,
        };
        const next = this.replaceMeta(state, nextMeta);
        const cardId = draw.card;
        const card = nextMeta.cards.find((entry) => entry.id === cardId) ?? null;
        return { state: next, card };
    }
    replaceMeta(state, meta) {
        return {
            ...state,
            metadata: { ...(state.metadata ?? {}), ...meta },
        };
    }
    getMeta(state) {
        return (state.metadata ?? {});
    }
    getTileByIndex(meta, index) {
        const tiles = meta.tiles ?? [];
        if (index < 0 || index >= tiles.length)
            return null;
        return tiles[index];
    }
    getPlayerPosition(state, playerId) {
        const meta = this.getMeta(state);
        return meta.positions?.[playerId] ?? 0;
    }
    pickOtherPlayer(state, playerId) {
        const candidates = Array.isArray(state.players)
            ? state.players.filter((p) => p?.id && p.id !== playerId)
            : [];
        return candidates.length ? (candidates[0].id ?? null) : null;
    }
    pawnLabel(state, playerId) {
        const players = Array.isArray(state.players) ? state.players : [];
        const player = players.find((p) => p?.id === playerId);
        const playerRecord = player && typeof player === 'object'
            ? player
            : {};
        const explicitLabel = typeof playerRecord.pawnLabel === 'string'
            ? playerRecord.pawnLabel.trim()
            : '';
        if (explicitLabel)
            return `"${explicitLabel}"`;
        const pawnId = typeof playerRecord.pawn === 'string' ? playerRecord.pawn.trim() : '';
        if (pawnId)
            return `"${pawnId}"`;
        const fallback = (0, player_name_helper_1.resolvePlayerNameFromState)(state, playerId);
        return `"${fallback}"`;
    }
};
exports.ToutPresDeMamanActionService = ToutPresDeMamanActionService;
exports.ToutPresDeMamanActionService = ToutPresDeMamanActionService = ToutPresDeMamanActionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [game_core_service_1.GameCoreService,
        random_service_1.RandomService,
        turn_flow_service_1.TurnFlowService,
        deck_policies_service_1.DeckPoliciesService])
], ToutPresDeMamanActionService);
//# sourceMappingURL=tout-pres-de-maman-action.service.js.map