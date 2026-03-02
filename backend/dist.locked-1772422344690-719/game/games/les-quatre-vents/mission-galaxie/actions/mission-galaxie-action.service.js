"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "MissionGalaxieActionService", {
    enumerable: true,
    get: function() {
        return MissionGalaxieActionService;
    }
});
const _common = require("@nestjs/common");
const _actionservicehelper = require("../../../../actions/action-service.helper");
const _playernamehelper = require("../../../../modules/turn-policies/player-name.helper");
const _gamecoreservice = require("../../../../core/services/game-core.service");
const _randomservice = require("../../../../modules/random/services/random.service");
const _turnflowservice = require("../../../../modules/turn/services/turn-flow.service");
const _deckpoliciesservice = require("../../../../modules/deck-policies/services/deck-policies.service");
const _pendingactionservice = require("../../../../modules/pending-action/services/pending-action.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
function asRecord(value) {
    return value != null && typeof value === 'object' ? value : {};
}
function asPartialMeta(value) {
    return value != null && typeof value === 'object' ? value : {};
}
function readEventMoveOptions(pending) {
    const row = asRecord(pending);
    const data = asRecord(row.data);
    const options = Array.isArray(data.options) ? data.options : [];
    return options.map((entry)=>{
        const option = asRecord(entry);
        return {
            targetPlayerId: Number(option.targetPlayerId),
            delta: Number(option.delta)
        };
    }).filter((entry)=>Number.isFinite(entry.targetPlayerId) && Number.isFinite(entry.delta));
}
let MissionGalaxieActionService = class MissionGalaxieActionService {
    applyActions(state, actions) {
        return (0, _actionservicehelper.applyActionsSequentially)((0, _actionservicehelper.harmonizeActionStateReturn)(state), actions, (next, action)=>{
            const current = (0, _actionservicehelper.harmonizeActionStateReturn)(next);
            const type = (0, _actionservicehelper.normalizeActionType)(action);
            return (0, _actionservicehelper.dispatchByActionType)(type, {
                roll: ()=>this.handleRoll(current),
                draw: ()=>this.handleDraw(current),
                choose_option: ()=>this.handleChooseOption(current, action),
                choose_event_move: ()=>this.handleChooseEventMove(current, action)
            }, ()=>current);
        });
    }
    handleRoll(state) {
        if (String(state.status ?? '').toLowerCase() !== 'started') return state;
        if (state.pending) return state;
        const currentId = state.turn?.currentPlayerId ?? null;
        if (currentId == null) return state;
        let meta = this.getMeta(state);
        const skipTurns = meta.statuses?.skipTurn?.[currentId] ?? 0;
        if (skipTurns > 0) {
            const nextStatuses = {
                ...meta.statuses,
                skipTurn: {
                    ...meta.statuses.skipTurn ?? {},
                    [currentId]: Math.max(0, skipTurns - 1)
                }
            };
            meta = {
                ...meta,
                statuses: nextStatuses
            };
            const skipped = this.core.appendLog({
                ...state,
                metadata: {
                    ...state.metadata ?? {},
                    ...meta
                }
            }, `${(0, _playernamehelper.resolvePlayerNameFromState)(state, currentId)} passe son tour (${skipTurns} restant).`);
            return this.turns.advanceTurn(skipped);
        }
        const rng = this.random.rollDice(meta, 6);
        meta = {
            ...meta,
            ...asPartialMeta(rng.meta)
        };
        const roll = rng.roll;
        let next = {
            ...state,
            lastRoll: roll,
            metadata: {
                ...state.metadata ?? {},
                ...meta
            }
        };
        next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, currentId)} lance le dé : "${roll}".`);
        next = this.move(next, currentId, roll);
        next = this.applyLanding(next, currentId);
        const updatedMeta = this.getMeta(next);
        if (updatedMeta.winnerId != null) return {
            ...next,
            status: 'finished'
        };
        if (next.pending) return next;
        const keepTurn = updatedMeta.keepTurn === true;
        if (keepTurn) {
            const nextMeta = {
                ...updatedMeta
            };
            delete nextMeta.keepTurn;
            next = {
                ...next,
                metadata: {
                    ...next.metadata ?? {},
                    ...nextMeta
                }
            };
            return this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, currentId)} rejoue.`);
        }
        return this.turns.advanceTurn(next);
    }
    handleDraw(state) {
        if (String(state.status ?? '').toLowerCase() !== 'started') return state;
        const pending = state.pending;
        if (!(0, _pendingactionservice.isPendingType)(state, 'draw')) return state;
        const pendingRow = asRecord(pending);
        const playerId = typeof pendingRow.playerId === 'number' ? pendingRow.playerId : state.turn?.currentPlayerId ?? null;
        if (playerId == null) return state;
        const pendingData = asRecord(pendingRow.data);
        const deckName = typeof pendingData.deck === 'string' ? pendingData.deck : undefined;
        if (!deckName) return state;
        const meta = this.getMeta(state);
        const draw = this.drawCard(meta, deckName);
        let next = {
            ...state,
            pending: null,
            metadata: {
                ...state.metadata ?? {},
                ...draw.meta
            }
        };
        const card = draw.card;
        if (!card) {
            return this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} n'a plus de cartes ${deckName}.`);
        }
        if (deckName === 'events') {
            return this.applyEventCard(next, playerId, card);
        }
        const cardKind = deckName === 'questions' ? 'question' : 'challenge';
        const ctx = {
            kind: cardKind,
            actorId: playerId,
            card: card
        };
        const pendingState = {
            type: 'choose_option',
            playerId,
            blocking: true,
            label: cardKind === 'question' ? 'Répondez à la question galactique.' : 'Résolvez le défi cosmique.',
            choices: card.choices,
            data: {
                choices: card.choices
            }
        };
        const withContext = this.getMeta(next);
        const updatedMeta = {
            ...withContext,
            pendingContext: ctx
        };
        next = (0, _pendingactionservice.createPendingState)(next, pendingState);
        next = {
            ...next,
            metadata: {
                ...next.metadata ?? {},
                ...updatedMeta
            }
        };
        return this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} pioche la carte "${card.title}".`);
    }
    handleChooseOption(state, action) {
        if (String(state.status ?? '').toLowerCase() !== 'started') return state;
        const currentId = state.turn?.currentPlayerId ?? null;
        if (currentId == null) return state;
        if (!(0, _pendingactionservice.isPendingType)(state, 'choose_option')) return state;
        const payload = asRecord(action.payload);
        const choiceIndex = Number(payload.choiceIndex);
        if (!Number.isFinite(choiceIndex)) return state;
        const meta = this.getMeta(state);
        const ctx = meta.pendingContext;
        if (!ctx || ctx.kind !== 'question' && ctx.kind !== 'challenge' || ctx.actorId !== currentId) {
            return {
                ...state,
                pending: null
            };
        }
        const card = ctx.card;
        const isCorrect = choiceIndex === card.correctIndex;
        const delta = isCorrect ? card.correctDelta : card.wrongDelta;
        let next = {
            ...state,
            pending: null,
            metadata: {
                ...state.metadata ?? {},
                ...meta,
                pendingContext: null
            }
        };
        next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, currentId)} répond à "${card.title}" : ${isCorrect ? 'Correct' : 'Erreur'} (${delta >= 0 ? 'avance' : 'recule'} ${Math.abs(delta)}).`);
        next = this.move(next, currentId, delta);
        next = this.applyLanding(next, currentId);
        return next;
    }
    handleChooseEventMove(state, action) {
        if (String(state.status ?? '').toLowerCase() !== 'started') return state;
        const currentId = state.turn?.currentPlayerId ?? null;
        if (currentId == null) return state;
        const pending = state.pending;
        if (!(0, _pendingactionservice.isPendingType)(state, 'choose_event_move')) return state;
        const payload = asRecord(action.payload);
        const targetPlayerId = Number(payload.targetPlayerId);
        const delta = Number(payload.delta);
        if (!Number.isFinite(targetPlayerId) || !Number.isFinite(delta)) return state;
        const meta = this.getMeta(state);
        const ctx = meta.pendingContext;
        if (!ctx || ctx.kind !== 'choosePlayerMove' || ctx.actorId !== currentId) {
            return {
                ...state,
                pending: null
            };
        }
        const options = readEventMoveOptions(pending);
        const isValid = options.some((opt)=>opt.targetPlayerId === targetPlayerId && opt.delta === delta);
        if (!isValid) return state;
        let next = {
            ...state,
            pending: null,
            metadata: {
                ...state.metadata ?? {},
                ...meta,
                pendingContext: null
            }
        };
        next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, currentId)} applique ${delta >= 0 ? 'un boost' : 'une perturbation'} à ${(0, _playernamehelper.resolvePlayerNameFromState)(next, targetPlayerId)} (${delta >= 0 ? '+' : ''}${delta}).`);
        next = this.move(next, targetPlayerId, delta);
        next = this.applyLanding(next, targetPlayerId);
        return next;
    }
    applyLanding(state, playerId) {
        let next = state;
        let meta = this.getMeta(next);
        const pos = meta.positions?.[playerId] ?? 0;
        const tile = meta.tiles[pos];
        if (!tile) return next;
        next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} place ${this.pawnLabel(next, playerId)} en case ${tile.n} (${tile.title}).`);
        switch(tile.type){
            case 'move':
                if (typeof tile.delta === 'number' && tile.delta !== 0) {
                    next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} suit l'effet du plateau (${tile.delta >= 0 ? 'avance' : 'recule'} ${Math.abs(tile.delta)}).`);
                    next = this.move(next, playerId, tile.delta);
                    return this.applyLanding(next, playerId);
                }
                break;
            case 'skip':
                {
                    meta = this.getMeta(next);
                    const currentSkip = meta.statuses?.skipTurn?.[playerId] ?? 0;
                    const addition = typeof tile.skipTurns === 'number' ? tile.skipTurns : 1;
                    meta = {
                        ...meta,
                        statuses: {
                            ...meta.statuses,
                            skipTurn: {
                                ...meta.statuses.skipTurn ?? {},
                                [playerId]: currentSkip + addition
                            }
                        }
                    };
                    next = {
                        ...next,
                        metadata: {
                            ...next.metadata ?? {},
                            ...meta
                        }
                    };
                    return this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} doit sauter ${addition} tour(s).`);
                }
            case 'question':
                next = this.core.appendLog(next, 'Piochez une question galactique.');
                return this.promptDraw(next, playerId, 'questions');
            case 'challenge':
                next = this.core.appendLog(next, 'Piochez un défi cosmique.');
                return this.promptDraw(next, playerId, 'challenges');
            case 'event':
                next = this.core.appendLog(next, 'Piochez un événement spatial.');
                return this.promptDraw(next, playerId, 'events');
            case 'swapNearest':
                return this.applySwapNearest(next, playerId);
            case 'goto':
                if (typeof tile.target === 'number') {
                    const targetIndex = Math.max(0, Math.min(tile.target - 1, meta.tiles.length - 1));
                    if (targetIndex !== pos) {
                        next = this.setPos(next, playerId, targetIndex);
                        return this.applyLanding(next, playerId);
                    }
                }
                break;
            case 'finish':
                return this.finishGame(next, playerId);
            default:
        }
        if (tile.keepTurn) {
            meta = this.getMeta(next);
            const updatedMeta = {
                ...meta,
                keepTurn: true
            };
            next = {
                ...next,
                metadata: {
                    ...next.metadata ?? {},
                    ...updatedMeta
                }
            };
            next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} reçoit un tour bonus.`);
        }
        return next;
    }
    promptDraw(state, playerId, deck) {
        const pending = {
            type: 'draw',
            playerId,
            blocking: true,
            label: deck === 'events' ? 'Piochez un événement spatial.' : deck === 'questions' ? 'Piochez une question galactique.' : 'Piochez un défi cosmique.',
            data: {
                deck
            }
        };
        return (0, _pendingactionservice.createPendingState)(state, pending);
    }
    applySwapNearest(state, playerId) {
        let next = state;
        let meta = this.getMeta(next);
        const pos = meta.positions?.[playerId] ?? 0;
        const entries = Object.entries(meta.positions ?? {}).map(([key, value])=>({
                id: Number(key),
                pos: value ?? 0
            })).filter((entry)=>Number.isFinite(entry.id) && entry.id !== playerId);
        if (!entries.length) return next;
        const closest = entries.reduce((best, current)=>{
            const diff = Math.abs(current.pos - pos);
            return best === null || diff < Math.abs(best.pos - pos) ? current : best;
        }, null);
        if (!closest) return next;
        const nextPositions = {
            ...meta.positions ?? {},
            [playerId]: closest.pos,
            [closest.id]: pos
        };
        meta = {
            ...meta,
            positions: nextPositions
        };
        next = {
            ...next,
            metadata: {
                ...next.metadata ?? {},
                ...meta
            }
        };
        return this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} échangée sa position avec ${(0, _playernamehelper.resolvePlayerNameFromState)(next, closest.id)}.`);
    }
    applyEventCard(state, playerId, card) {
        let next = this.core.appendLog(state, `${(0, _playernamehelper.resolvePlayerNameFromState)(state, playerId)} déclenche l'événement "${card.title}".`);
        const effect = card.effect;
        switch(effect.kind){
            case 'move':
                next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} avance de ${effect.delta} cases.`);
                next = this.move(next, playerId, effect.delta);
                return this.applyLanding(next, playerId);
            case 'skip':
                next = this.addSkip(next, playerId, effect.turns);
                return this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} doit sauter ${effect.turns} tour(s).`);
            case 'none':
                return next;
            case 'reroll':
                next = this.setKeepTurn(next);
                return this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} relance immédiatement le dé.`);
            case 'keepTurn':
                next = this.setKeepTurn(next);
                return this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} rejoue immédiatement.`);
            case 'goto':
                next = this.setPos(next, playerId, Math.max(0, Math.min(effect.target - 1, this.getMeta(next).tiles.length - 1)));
                next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} avance jusqu'à la case ${effect.target}.`);
                return this.applyLanding(next, playerId);
            case 'skipOthers':
                next = this.skipOthers(next, playerId, effect.turns);
                return this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} force les autres à sauter ${effect.turns} tour(s).`);
            case 'choosePlayerMove':
                return this.promptPlayerMove(next, playerId, effect.deltas);
            default:
                return next;
        }
    }
    promptPlayerMove(state, playerId, deltas) {
        let next = state;
        const players = Array.isArray(state.players) ? state.players : [];
        const options = [];
        const targetPlayers = players.filter((p)=>p?.id != null);
        for (const delta of deltas){
            for (const player of targetPlayers){
                const targetId = player.id;
                options.push({
                    targetPlayerId: targetId,
                    delta,
                    label: `${(0, _playernamehelper.resolvePlayerNameFromState)(next, targetId)} ${delta >= 0 ? `avance de ${delta}` : `recule de ${Math.abs(delta)}`}`
                });
            }
        }
        const pending = {
            type: 'choose_event_move',
            playerId,
            blocking: true,
            label: 'Choisissez un joueur et un mouvement.',
            data: {
                options
            }
        };
        const nextMeta = {
            ...this.getMeta(next),
            pendingContext: {
                kind: 'choosePlayerMove',
                actorId: playerId,
                deltas
            }
        };
        next = (0, _pendingactionservice.createPendingState)(next, pending);
        next = {
            ...next,
            metadata: {
                ...next.metadata ?? {},
                ...nextMeta
            }
        };
        return next;
    }
    addSkip(state, playerId, turns) {
        const meta = this.getMeta(state);
        const currentSkip = meta.statuses?.skipTurn?.[playerId] ?? 0;
        const nextMeta = {
            ...meta,
            statuses: {
                ...meta.statuses,
                skipTurn: {
                    ...meta.statuses.skipTurn ?? {},
                    [playerId]: currentSkip + turns
                }
            }
        };
        return {
            ...state,
            metadata: {
                ...state.metadata ?? {},
                ...nextMeta
            }
        };
    }
    setKeepTurn(state) {
        const meta = this.getMeta(state);
        const nextMeta = {
            ...meta,
            keepTurn: true
        };
        return {
            ...state,
            metadata: {
                ...state.metadata ?? {},
                ...nextMeta
            }
        };
    }
    skipOthers(state, playerId, turns) {
        const meta = this.getMeta(state);
        const skip = {
            ...meta.statuses.skipTurn ?? {}
        };
        const players = Array.isArray(state.players) ? state.players : [];
        for (const player of players){
            if (player?.id == null || player.id === playerId) continue;
            skip[player.id] = (skip[player.id] ?? 0) + turns;
        }
        const nextMeta = {
            ...meta,
            statuses: {
                ...meta.statuses,
                skipTurn: skip
            }
        };
        return {
            ...state,
            metadata: {
                ...state.metadata ?? {},
                ...nextMeta
            }
        };
    }
    finishGame(state, playerId) {
        const meta = this.getMeta(state);
        const next = {
            ...state,
            metadata: {
                ...state.metadata ?? {},
                ...meta,
                winnerId: playerId
            },
            status: 'finished'
        };
        return this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} atteint la planète légendaire !`);
    }
    move(state, playerId, delta) {
        const meta = this.getMeta(state);
        const position = meta.positions?.[playerId] ?? 0;
        const newPosition = Math.max(0, Math.min(position + delta, (meta.tiles?.length ?? 1) - 1));
        return this.setPos(state, playerId, newPosition);
    }
    setPos(state, playerId, pos) {
        const meta = this.getMeta(state);
        const nextMeta = {
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
                ...nextMeta
            }
        };
    }
    drawCard(meta, deck) {
        const draw = this.deckPolicies.drawFromPile({
            meta,
            pile: Array.isArray(meta.decks?.[deck]) ? meta.decks[deck] : [],
            discard: Array.isArray(meta.discards?.[deck]) ? meta.discards[deck] : [],
            useWholeMetaRng: true,
            discardDrawnCard: true
        });
        const nextMeta = {
            ...draw.meta,
            decks: {
                ...draw.meta.decks,
                [deck]: draw.pile
            },
            discards: {
                ...draw.meta.discards,
                [deck]: draw.discard
            }
        };
        return {
            card: draw.card,
            meta: nextMeta
        };
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
    getMeta(state) {
        return state.metadata ?? {};
    }
    constructor(random, turns, core, deckPolicies){
        this.random = random;
        this.turns = turns;
        this.core = core;
        this.deckPolicies = deckPolicies;
    }
};
MissionGalaxieActionService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _randomservice.RandomService === "undefined" ? Object : _randomservice.RandomService,
        typeof _turnflowservice.TurnFlowService === "undefined" ? Object : _turnflowservice.TurnFlowService,
        typeof _gamecoreservice.GameCoreService === "undefined" ? Object : _gamecoreservice.GameCoreService,
        typeof _deckpoliciesservice.DeckPoliciesService === "undefined" ? Object : _deckpoliciesservice.DeckPoliciesService
    ])
], MissionGalaxieActionService);
