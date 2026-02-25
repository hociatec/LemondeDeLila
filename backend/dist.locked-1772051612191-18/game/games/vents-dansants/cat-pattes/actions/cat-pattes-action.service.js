"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "CatPattesActionService", {
    enumerable: true,
    get: function() {
        return CatPattesActionService;
    }
});
const _common = require("@nestjs/common");
const _playernamehelper = require("../../../../modules/turn-policies/player-name.helper");
const _gamecoreservice = require("../../../../core/services/game-core.service");
const _turnflowservice = require("../../../../modules/turn/services/turn-flow.service");
const _setupflowservice = require("../../../../modules/setup-flow/services/setup-flow.service");
const _deckpoliciesservice = require("../../../../modules/deck-policies/services/deck-policies.service");
const _randomservice = require("../../../../modules/random/services/random.service");
const _turnpoliciesservice = require("../../../../modules/turn-policies/services/turn-policies.service");
const _promptpoliciesservice = require("../../../../modules/prompt-policies/services/prompt-policies.service");
const _pawnchoiceactionhelper = require("../../../../core/helpers/pawn-choice-action.helper");
const _catpattescards = require("../model/cat-pattes-cards");
const _actionservicehelper = require("../../../../actions/action-service.helper");
const _catpattesstateentity = require("../model/cat-pattes-state.entity");
const _rulebook = require("../rulebook/rulebook");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
function _ts_param(paramIndex, decorator) {
    return function(target, key) {
        decorator(target, key, paramIndex);
    };
}
let CatPattesActionService = class CatPattesActionService {
    applyActions(state, actions) {
        const next = (0, _actionservicehelper.applyActionsSequentially)(this.ensurePawnSelectionPrompt(state), actions, (next, action)=>{
            const type = (0, _actionservicehelper.normalizeActionType)(action);
            return (0, _actionservicehelper.dispatchByActionType)(type, {
                choose_pawn: ()=>{
                    next = this.handleChoosePawn(next, action);
                    next = this.ensurePawnSelectionPrompt(next);
                    return next;
                },
                draw: ()=>{
                    next = this.handleDraw(next);
                    return next;
                },
                play_card: ()=>{
                    next = this.handlePlayCard(next, action);
                    return next;
                },
                discard_card: ()=>{
                    next = this.handleDiscard(next, action);
                    return next;
                },
                pass: ()=>{
                    next = this.handleDiscard(next, action);
                    return next;
                }
            }, ()=>next);
        });
        return this.ensurePawnSelectionPrompt(next);
    }
    handleChoosePawn(state, action) {
        const status = String(state.status ?? '').toLowerCase();
        if (status !== 'started') return state;
        const resolved = (0, _pawnchoiceactionhelper.resolvePendingPawnChoiceAction)({
            state,
            action,
            pendingType: 'choose_pawn',
            resolveChoice: (rawPawn, options)=>this.setupFlow.resolvePawnChoice(rawPawn, options)
        });
        if (!resolved) return state;
        const { playerId, options, chosen } = resolved;
        const meta = this.getMeta(state);
        const assigned = {
            ...meta.pawnByPlayerId ?? {}
        };
        if (assigned[playerId]) return state;
        if (Object.values(assigned).some((id)=>id === chosen.id)) return state;
        const nextMeta = {
            ...meta,
            pawns: Array.isArray(meta.pawns) && meta.pawns.length > 0 ? meta.pawns : options.map((p)=>String(p?.label ?? p?.id ?? '').trim()),
            pawnByPlayerId: {
                ...assigned,
                [playerId]: chosen.id
            }
        };
        let next = {
            ...state,
            pending: null,
            metadata: nextMeta
        };
        next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} choisit le pion : ${chosen.label}.`);
        const playersForPending = Array.isArray(next.players) ? next.players : [];
        const metaForPending = this.getMeta(next);
        const pawnByPlayerIdForPending = metaForPending.pawnByPlayerId ?? {};
        const usedForPending = new Set(Object.values(pawnByPlayerIdForPending).filter((v)=>typeof v === 'string'));
        const choicesForPending = (metaForPending.pawns ?? []).filter((p)=>!usedForPending.has(p));
        const pendingInfo = this.setupFlow.createSequentialPawnPending({
            players: playersForPending,
            startPlayerId: playerId,
            isAssigned: (candidateId)=>{
                const player = playersForPending.find((p)=>p?.id === candidateId);
                return Boolean(pawnByPlayerIdForPending[candidateId]) || this.isBotLike(player);
            },
            pawns: choicesForPending.map((name)=>({
                    id: name,
                    label: name
                }))
        });
        if (pendingInfo) {
            const withPending = {
                ...next,
                pending: pendingInfo.pending,
                turnIndex: pendingInfo.turnIndex,
                turn: {
                    ...next.turn ?? {
                        direction: 1
                    },
                    currentPlayerId: pendingInfo.playerId,
                    direction: 1
                }
            };
            return this.ensurePawnSelectionPrompt(withPending);
        }
        next = this.assignMissingBotPawns(next);
        const players = Array.isArray(next.players) ? next.players : [];
        const starterId = typeof nextMeta.setupStarterId === 'number' ? nextMeta.setupStarterId : players[0]?.id ?? null;
        const starterIndex = starterId != null ? players.findIndex((p)=>p?.id === starterId) : -1;
        const resolvedStarterId = starterId != null && starterIndex >= 0 ? starterId : players[0]?.id ?? null;
        let started = {
            ...next,
            pending: null,
            turnIndex: starterIndex >= 0 ? starterIndex : next.turnIndex,
            turn: {
                ...next.turn ?? {
                    direction: 1
                },
                currentPlayerId: resolvedStarterId,
                direction: 1
            }
        };
        started = this.core.appendLog(started, `Début de partie : ${(0, _playernamehelper.resolvePlayerNameFromState)(started, resolvedStarterId ?? 0)} commence.`);
        return this.getTurnPolicies().appendTurnAnnouncement(started, resolvedStarterId, (s, id)=>(0, _playernamehelper.resolvePlayerNameFromState)(s, id));
    }
    handleDraw(state) {
        const status = String(state.status ?? '').toLowerCase();
        if (status !== 'started') return state;
        if (state.pending) return state;
        const currentId = this.toPlayerId(state.turn?.currentPlayerId ?? null);
        if (currentId == null) return state;
        const meta = this.getMeta(state);
        if (this.samePlayerId(meta.drawnPlayerId, currentId)) return state;
        const { meta: updatedMeta, cardId } = this.drawForPlayer(meta, currentId);
        let next = this.setMeta(state, {
            ...updatedMeta,
            drawnPlayerId: currentId
        });
        next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, currentId)} pioche.`);
        if (cardId) {
            next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, currentId)} pioche ${_catpattescards.CAT_PATTES_CARD_BY_ID[cardId]?.name ?? 'une carte'}.`);
            return next;
        }
        const remainingHand = Array.isArray(updatedMeta.hands?.[currentId]) ? updatedMeta.hands[currentId] : [];
        if (remainingHand.length > 0) return next;
        next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, currentId)} ne peut plus piocher.`);
        next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, currentId)} passe son tour.`);
        next = this.clearDrawn(next);
        return this.turns.advanceTurn(next);
    }
    handleDiscard(state, action) {
        const currentId = this.toPlayerId(state.turn?.currentPlayerId ?? null);
        if (currentId == null) return state;
        const meta = this.getMeta(state);
        if (!this.samePlayerId(meta.drawnPlayerId, currentId)) return state;
        const payload = action.payload ?? {};
        let cardId = String(payload.cardId ?? '').trim();
        const hand = Array.isArray(meta.hands?.[currentId]) ? [
            ...meta.hands[currentId]
        ] : [];
        if (!cardId) cardId = String(hand[0] ?? '').trim();
        if (!cardId || !hand.includes(cardId)) return state;
        let updatedMeta = this.removeCardFromHand(meta, currentId, cardId);
        updatedMeta = this.addCardToDiscard(updatedMeta, cardId);
        let next = this.setMeta(state, updatedMeta);
        next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, currentId)} défausse ${_catpattescards.CAT_PATTES_CARD_BY_ID[cardId]?.name ?? 'une carte'}.`);
        next = this.clearDrawn(next);
        return this.turns.advanceTurn(next);
    }
    handlePlayCard(state, action) {
        const currentId = this.toPlayerId(state.turn?.currentPlayerId ?? null);
        if (currentId == null) return state;
        const payload = action.payload ?? {};
        const cardId = String(payload.cardId ?? '').trim();
        if (!cardId) return state;
        const definition = _catpattescards.CAT_PATTES_CARD_BY_ID[cardId];
        if (!definition) return state;
        const meta = this.getMeta(state);
        if (meta.drawnPlayerId !== currentId) return state;
        const hand = Array.isArray(meta.hands?.[currentId]) ? meta.hands[currentId] : [];
        if (!hand.includes(cardId)) return state;
        if (definition.type === 'pattes') {
            if (!(0, _rulebook.canPlayPattes)(meta, currentId, definition)) return state;
            const currentPos = Number(meta.positions?.[currentId] ?? 0);
            const delta = Number(definition.value ?? 0);
            if (!Number.isFinite(delta) || currentPos + delta > _catpattesstateentity.CAT_PATTES_GOAL) return state;
        }
        if (definition.type === 'obstacle') {
            const targetId = typeof payload.targetPlayerId === 'number' ? payload.targetPlayerId : null;
            if (targetId == null || targetId === currentId) return state;
            if (!(0, _rulebook.playerCanReceiveObstacle)(meta, targetId, definition.obstacle)) return state;
        }
        const hadObstacle = Boolean(meta.obstacles?.[currentId]);
        let updatedMeta = this.removeCardFromHand(meta, currentId, cardId);
        updatedMeta = this.addCardToDiscard(updatedMeta, cardId);
        let next = this.setMeta(state, updatedMeta);
        if (definition.type === 'pattes') {
            next = this.playPattes(next, currentId, definition);
        } else if (definition.type === 'obstacle') {
            const targetId = typeof payload.targetPlayerId === 'number' ? payload.targetPlayerId : null;
            if (targetId != null) {
                next = this.playObstacle(next, currentId, targetId, definition);
            }
        } else if (definition.type === 'parade') {
            next = this.playParade(next, currentId, definition);
        } else if (definition.type === 'bot') {
            next = this.playBot(next, currentId, definition);
        }
        if (this.getMeta(next).winnerId != null) {
            return this.clearDrawn(next);
        }
        // Règle: si un Pouvoir est joué en réponse à un obstacle, le joueur rejoue immédiatement.
        // Interprétation: si un obstacle est actif au moment où le Pouvoir est joué, on conserve le tour.
        if (definition.type === 'bot' && hadObstacle) {
            const withLog = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, currentId)} rejoue immédiatement grâce au Pouvoir.`);
            return this.clearDrawn(withLog);
        }
        next = this.clearDrawn(next);
        return this.turns.advanceTurn(next);
    }
    playPattes(state, playerId, card) {
        const meta = this.getMeta(state);
        const positions = {
            ...meta.positions ?? {}
        };
        const previous = positions[playerId] ?? 0;
        const delta = card.value ?? 0;
        const nextPosition = previous + delta;
        positions[playerId] = nextPosition;
        const turboPlayed = {
            ...meta.turboPlayed ?? {}
        };
        if ((card.value ?? 0) === 150) {
            turboPlayed[playerId] = (turboPlayed[playerId] ?? 0) + 1;
        }
        let next = this.setMeta(state, {
            ...meta,
            positions,
            turboPlayed
        });
        next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} joue ${card.name} et avance de ${delta} pattes (total ${nextPosition}/${_catpattesstateentity.CAT_PATTES_GOAL}).`);
        if (nextPosition === _catpattesstateentity.CAT_PATTES_GOAL) {
            const finalMeta = this.getMeta(next);
            const roundPoints = this.computeRoundPoints(next, playerId, finalMeta);
            const points = {
                ...finalMeta.points ?? {}
            };
            points[playerId] = (points[playerId] ?? 0) + roundPoints;
            next = this.setMeta(next, {
                ...finalMeta,
                points,
                winnerId: playerId
            });
            next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} atteint ${_catpattesstateentity.CAT_PATTES_GOAL} pattes et remporte la manche (${roundPoints} points).`);
            return {
                ...next,
                status: 'finished'
            };
        }
        return next;
    }
    computeRoundPoints(state, winnerId, meta) {
        let points = _catpattesstateentity.CAT_PATTES_GOAL;
        const turboCount = Number(meta.turboPlayed?.[winnerId] ?? 0);
        if (turboCount >= 4) points += 200;
        const players = (state.players ?? []).filter((p)=>p?.id != null);
        const othersBlocked = players.filter((p)=>p.id !== winnerId).every((p)=>Boolean(meta.obstacles?.[p.id]));
        if (othersBlocked && players.length > 1) points += 100;
        const botCount = Array.isArray(meta.bots?.[winnerId]) ? meta.bots[winnerId].length : 0;
        if (botCount >= 4) points += 300;
        return points;
    }
    playObstacle(state, playerId, targetId, card) {
        const obstacle = card.obstacle;
        if (!obstacle) return state;
        const meta = this.getMeta(state);
        if (!(0, _rulebook.playerCanReceiveObstacle)(meta, targetId, obstacle)) {
            return state;
        }
        const obstacles = {
            ...meta.obstacles ?? {}
        };
        obstacles[targetId] = obstacle;
        let next = this.setMeta(state, {
            ...meta,
            obstacles
        });
        next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} inflige ${card.name} à ${(0, _playernamehelper.resolvePlayerNameFromState)(next, targetId)}.`);
        return next;
    }
    playParade(state, playerId, card) {
        let next = state;
        let meta = this.getMeta(next);
        const obstacles = {
            ...meta.obstacles ?? {}
        };
        const currentObstacle = obstacles[playerId] ?? null;
        if (currentObstacle && card.parade && _rulebook.CAT_PATTES_OBSTACLE_TO_PARADE[currentObstacle] === card.parade) {
            obstacles[playerId] = null;
            meta = {
                ...meta,
                obstacles
            };
            next = this.setMeta(next, meta);
            next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} neutralise ${currentObstacle} avec ${card.name}.`);
            meta = this.getMeta(next);
        }
        if (card.parade === 'rayon') {
            const hasSun = {
                ...meta.hasSun ?? {}
            };
            hasSun[playerId] = true;
            meta = {
                ...meta,
                hasSun
            };
            next = this.setMeta(next, meta);
        }
        return next;
    }
    playBot(state, playerId, card) {
        const bot = card.bot;
        if (!bot) return state;
        const meta = this.getMeta(state);
        const bots = {
            ...meta.bots ?? {}
        };
        const playerBots = [
            ...bots[playerId] ?? []
        ];
        if (!playerBots.includes(bot)) {
            playerBots.push(bot);
        }
        bots[playerId] = playerBots;
        let next = this.setMeta(state, {
            ...meta,
            bots
        });
        next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} active ${card.name} (Pouvoir).`);
        return next;
    }
    clearDrawn(state) {
        const meta = this.getMeta(state);
        return this.setMeta(state, {
            ...meta,
            drawnPlayerId: null
        });
    }
    drawForPlayer(meta, playerId) {
        const { cardId, meta: withCard } = this.drawOneCard(meta);
        if (!cardId) {
            return {
                meta: withCard,
                cardId: null
            };
        }
        const hands = {
            ...withCard.hands ?? {}
        };
        const playerHand = [
            ...hands[playerId] ?? []
        ];
        playerHand.push(cardId);
        hands[playerId] = playerHand;
        return {
            meta: {
                ...withCard,
                hands
            },
            cardId
        };
    }
    drawOneCard(meta) {
        const out = this.deckPolicies.drawOne({
            meta,
            deckKey: 'deck',
            discardKey: 'discard',
            rngKey: 'rng'
        });
        return {
            cardId: out.card,
            meta: out.meta
        };
    }
    removeCardFromHand(meta, playerId, cardId) {
        const hands = {
            ...meta.hands ?? {}
        };
        const playerHand = Array.isArray(hands[playerId]) ? [
            ...hands[playerId]
        ] : [];
        const index = playerHand.indexOf(cardId);
        if (index >= 0) {
            playerHand.splice(index, 1);
        }
        hands[playerId] = playerHand;
        return {
            ...meta,
            hands
        };
    }
    addCardToDiscard(meta, cardId) {
        const discard = [
            ...meta.discard ?? [],
            cardId
        ];
        return {
            ...meta,
            discard
        };
    }
    getMeta(state) {
        return state.metadata ?? {};
    }
    setMeta(state, metadata) {
        return {
            ...state,
            metadata
        };
    }
    ensurePawnSelectionPrompt(state) {
        if (String(state.status ?? '').toLowerCase() !== 'started') return state;
        const players = Array.isArray(state.players) ? state.players : [];
        if (!players.length) return state;
        const meta = this.getMeta(state);
        const hasAssignedPawn = (playerId)=>{
            if (meta.pawnByPlayerId?.[playerId]) return true;
            const player = players.find((p)=>Number(p?.id) === Number(playerId));
            const playerPawn = typeof player?.pawn === 'string' ? player.pawn.trim() : '';
            return playerPawn.length > 0;
        };
        const needsPawn = (player)=>!this.isBotLike(player) && !hasAssignedPawn(Number(player?.id));
        const missingHumans = players.filter((player)=>needsPawn(player));
        if (!missingHumans.length) {
            return state.pending?.type === 'choose_pawn' ? {
                ...state,
                pending: null
            } : state;
        }
        if (state.pending?.type === 'choose_pawn') {
            const pendingPlayerId = Number(state.pending.playerId);
            if (Number.isFinite(pendingPlayerId) && missingHumans.some((player)=>Number(player?.id) === pendingPlayerId)) {
                return state;
            }
        }
        const usedPawns = new Set(Object.values(meta.pawnByPlayerId ?? {}).filter((pawn)=>typeof pawn === 'string' && pawn.trim().length > 0));
        const allPawns = Array.isArray(meta.pawns) ? meta.pawns : [];
        const availablePawns = allPawns.filter((pawn)=>!usedPawns.has(pawn));
        const selectedPawns = availablePawns.length > 0 ? availablePawns : allPawns;
        if (!selectedPawns.length) return state;
        const pendingInfo = this.setupFlow.createSequentialPawnPending({
            players,
            startPlayerId: typeof state.turn?.currentPlayerId === 'number' ? state.turn.currentPlayerId : players[0]?.id ?? null,
            isAssigned: (playerId)=>{
                const player = players.find((entry)=>Number(entry?.id) === playerId);
                return this.isBotLike(player) || hasAssignedPawn(playerId);
            },
            pawns: selectedPawns.map((name)=>({
                    id: name,
                    label: name
                }))
        });
        if (!pendingInfo) return state;
        const next = {
            ...state,
            pending: pendingInfo.pending,
            turnIndex: pendingInfo.turnIndex,
            turn: {
                ...state.turn ?? {
                    direction: 1
                },
                currentPlayerId: pendingInfo.playerId,
                direction: 1
            }
        };
        return next;
    }
    getTurnPolicies() {
        return this.turnPolicies ?? new _turnpoliciesservice.TurnPoliciesService(this.core);
    }
    assignMissingBotPawns(state) {
        const players = Array.isArray(state.players) ? state.players : [];
        const meta = this.getMeta(state);
        const assigned = {
            ...meta.pawnByPlayerId ?? {}
        };
        const used = new Set(Object.values(assigned).filter((v)=>typeof v === 'string' && v.trim().length > 0));
        const pool = Array.isArray(meta.pawns) ? meta.pawns.filter((pawn)=>!used.has(pawn)) : [];
        const out = this.random.shuffle(meta, pool);
        const pawns = Array.isArray(out.values) ? out.values : [];
        const shuffledRng = out.meta?.rng ?? meta.rng;
        let next = state;
        let changed = false;
        let pawnIndex = 0;
        for (const player of players){
            if (!player?.id || !this.isBotLike(player)) continue;
            if (assigned[player.id]) continue;
            const nextPawn = pawns[pawnIndex];
            if (!nextPawn) break;
            assigned[player.id] = nextPawn;
            used.add(nextPawn);
            pawnIndex += 1;
            changed = true;
            next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, player.id)} choisit le pion : ${nextPawn}.`);
        }
        if (!changed) return state;
        return this.setMeta(next, {
            ...this.getMeta(next),
            rng: shuffledRng,
            pawnByPlayerId: assigned
        });
    }
    isBotLike(player) {
        if (!player) return false;
        if (player.isBot === true) return true;
        const username = String(player?.username ?? '').trim().toLowerCase();
        if (username.includes('bot')) return true;
        const kind = String(player?.kind ?? player?.type ?? '').trim().toLowerCase();
        return kind === 'bot' || kind === 'ai';
    }
    toPlayerId(value) {
        if (typeof value === 'number' && Number.isFinite(value)) return value;
        if (typeof value === 'string') {
            const parsed = Number(value.trim());
            if (Number.isFinite(parsed)) return parsed;
        }
        return null;
    }
    samePlayerId(left, right) {
        const a = this.toPlayerId(left);
        const b = this.toPlayerId(right);
        return a != null && b != null && a === b;
    }
    constructor(core, turns, setupFlow, deckPolicies, random, turnPolicies, _promptPolicies){
        this.core = core;
        this.turns = turns;
        this.setupFlow = setupFlow;
        this.deckPolicies = deckPolicies;
        this.random = random;
        this.turnPolicies = turnPolicies;
    }
};
CatPattesActionService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_param(5, (0, _common.Optional)()),
    _ts_param(6, (0, _common.Optional)()),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _gamecoreservice.GameCoreService === "undefined" ? Object : _gamecoreservice.GameCoreService,
        typeof _turnflowservice.TurnFlowService === "undefined" ? Object : _turnflowservice.TurnFlowService,
        typeof _setupflowservice.SetupFlowService === "undefined" ? Object : _setupflowservice.SetupFlowService,
        typeof _deckpoliciesservice.DeckPoliciesService === "undefined" ? Object : _deckpoliciesservice.DeckPoliciesService,
        typeof _randomservice.RandomService === "undefined" ? Object : _randomservice.RandomService,
        typeof _turnpoliciesservice.TurnPoliciesService === "undefined" ? Object : _turnpoliciesservice.TurnPoliciesService,
        typeof _promptpoliciesservice.PromptPoliciesService === "undefined" ? Object : _promptpoliciesservice.PromptPoliciesService
    ])
], CatPattesActionService);
