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
const OBSTACLE_LABELS = {
    gamelle: 'Gamelle vide',
    pluie: 'Pluie torrentielle',
    chien: 'Chien enragé',
    coussin: 'Coussin piégé',
    sol: 'Sol ciré'
};
const _PARADE_LABELS = {
    croquettes: 'Croquettes',
    rayon: 'Rayon de soleil',
    dodo: 'Dodo réparateur',
    coussin: 'Nouveau coussin',
    saut: 'Saut agile'
};
const BOT_EFFECTS = {
    reserve: 'Ignore Gamelle vide.',
    'chat-ninja': 'Ignore Chien enragé.',
    'patte-blindee': 'Ignore Coussin piégé.',
    'passage-star': 'Ignore Pluie torrentielle et Sol ciré, et permet de jouer sans soleil.'
};
const OBSTACLE_IMPACTS = {
    gamelle: "ne peut plus jouer de cartes Pattes tant que l'obstacle n'est pas retiré",
    pluie: "ne peut plus jouer de cartes Pattes tant que l'obstacle n'est pas retiré",
    chien: "ne peut plus jouer de cartes Pattes tant que l'obstacle n'est pas retiré",
    coussin: "ne peut plus jouer de cartes Pattes tant que l'obstacle n'est pas retiré",
    sol: "ne peut plus jouer de cartes Pattes tant que l'obstacle n'est pas retiré"
};
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
                cat_pattes_set_config: ()=>{
                    next = this.handleSetConfig(next, action);
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
            setupStep: 'choose_pawn',
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
        next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} a choisi le pion : ${chosen.label}.`);
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
            metadata: {
                ...this.getMeta(next),
                setupStep: 'playing'
            },
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
        if ((this.getMeta(state).setupStep ?? '') === 'setup_config') return state;
        const currentId = this.toPlayerId(state.turn?.currentPlayerId ?? null);
        if (currentId == null) return state;
        const meta = this.getMeta(state);
        if (this.samePlayerId(meta.drawnPlayerId, currentId)) return state;
        const { meta: updatedMeta, cardId } = this.drawForPlayer(meta, currentId);
        let next = this.setMeta(state, {
            ...updatedMeta,
            drawnPlayerId: currentId
        });
        if (cardId) {
            next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, currentId)} pioche ${_catpattescards.CAT_PATTES_CARD_BY_ID[cardId]?.name ?? 'une carte'}.`);
            return next;
        }
        next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, currentId)} pioche.`);
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
        if ((meta.setupStep ?? '') === 'setup_config') return state;
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
        if ((this.getMeta(state).setupStep ?? '') === 'setup_config') return state;
        const payload = action.payload ?? {};
        const cardId = String(payload.cardId ?? '').trim();
        if (!cardId) return state;
        const definition = _catpattescards.CAT_PATTES_CARD_BY_ID[cardId];
        if (!definition) return state;
        const meta = this.getMeta(state);
        if (meta.drawnPlayerId !== currentId) return state;
        const hand = Array.isArray(meta.hands?.[currentId]) ? meta.hands[currentId] : [];
        if (!hand.includes(cardId)) return state;
        const blockedByObstacle = (0, _rulebook.isBlockedByObstacle)(meta, currentId);
        if (blockedByObstacle && definition.type !== 'parade' && definition.type !== 'bot') {
            return state;
        }
        if (definition.type === 'pattes') {
            if (!(0, _rulebook.canPlayPattes)(meta, currentId, definition)) return state;
            const currentPos = Number(meta.positions?.[currentId] ?? 0);
            const delta = Number(definition.value ?? 0);
            if (!Number.isFinite(delta) || currentPos + delta > this.getGoalPattes(meta)) return state;
        }
        if (definition.type === 'obstacle') {
            const targetId = typeof payload.targetPlayerId === 'number' ? payload.targetPlayerId : null;
            if (targetId == null || targetId === currentId) return state;
            if (!(0, _rulebook.playerCanReceiveObstacle)(meta, targetId, definition.obstacle)) return state;
        }
        if (definition.type === 'parade') {
            if (!(0, _rulebook.canPlayParade)(meta, currentId, definition)) return state;
        }
        if (definition.type === 'bot') {
            if (!(0, _rulebook.canPlayBot)(meta, currentId, definition)) return state;
        }
        let updatedMeta = this.removeCardFromHand(meta, currentId, cardId);
        updatedMeta = this.addCardToDiscard(updatedMeta, cardId);
        let next = this.setMeta(state, updatedMeta);
        next = this.appendPlayedCardNarration(next, currentId, definition);
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
        if (!this.samePlayerId(this.getMeta(next).drawnPlayerId, currentId)) {
            return next;
        }
        // Règle: un Pouvoir rejoue immédiatement.
        if (definition.type === 'bot') {
            const withLog = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, currentId)} rejoue immédiatement grâce au Pouvoir.`);
            return this.clearDrawn(withLog);
        }
        next = this.clearDrawn(next);
        return this.turns.advanceTurn(next);
    }
    handleSetConfig(state, action) {
        const status = String(state.status ?? '').toLowerCase();
        if (status !== 'started') return state;
        const meta = this.getMeta(state);
        if ((meta.setupStep ?? '') !== 'setup_config') return state;
        const currentId = this.toPlayerId(state.turn?.currentPlayerId ?? null);
        if (currentId == null || !this.samePlayerId(meta.ownerPlayerId, currentId)) {
            return state;
        }
        const payload = action.payload ?? {};
        const rawGoal = Number(payload.goalPattes ?? payload.value ?? null);
        if (!Number.isFinite(rawGoal)) return state;
        const goalPattes = Math.round(rawGoal);
        if (goalPattes < 600 || goalPattes > 1500) return state;
        const hasPointsToWin = payload.pointsToWin != null;
        const rawPointsToWin = hasPointsToWin ? Number(payload.pointsToWin) : NaN;
        const pointsToWin = Number.isFinite(rawPointsToWin) ? Math.round(rawPointsToWin) : this.getPointsToWin(meta);
        if (pointsToWin < 1000 || pointsToWin > 20000) return state;
        let next = this.setMeta(state, {
            ...meta,
            setupStep: 'choose_pawn',
            goalPattes,
            pointsToWin
        });
        next = {
            ...next,
            pending: null
        };
        return this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, currentId)} fixe l'objectif à ${goalPattes} pattes et ${pointsToWin} points pour gagner la partie.`);
    }
    playPattes(state, playerId, card) {
        const meta = this.getMeta(state);
        const goalPattes = this.getGoalPattes(meta);
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
        next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} avance de ${delta} pattes (total ${nextPosition}/${goalPattes}).`);
        if (nextPosition === goalPattes) {
            const finalMeta = this.getMeta(next);
            const roundPoints = this.computeRoundPoints(next, playerId, finalMeta, goalPattes);
            const points = {
                ...finalMeta.points ?? {}
            };
            const totalPoints = (points[playerId] ?? 0) + roundPoints;
            points[playerId] = totalPoints;
            const pointsToWin = this.getPointsToWin(finalMeta);
            next = this.setMeta(next, {
                ...finalMeta,
                points,
                winnerId: totalPoints >= pointsToWin ? playerId : null,
                drawnPlayerId: null
            });
            next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} atteint ${goalPattes} pattes et remporte la manche (${roundPoints} points).`);
            if (totalPoints >= pointsToWin) {
                next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} totalise ${totalPoints} points et remporte la partie.`);
                return {
                    ...next,
                    status: 'finished'
                };
            }
            return this.startNextRound(next, playerId);
        }
        return next;
    }
    computeRoundPoints(state, winnerId, meta, goalPattes) {
        let points = goalPattes;
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
        const targetName = (0, _playernamehelper.resolvePlayerNameFromState)(next, targetId);
        const impact = OBSTACLE_IMPACTS[obstacle];
        next = this.core.appendLog(next, `${targetName} ${impact}.`);
        return next;
    }
    playParade(state, playerId, card) {
        let next = state;
        let meta = this.getMeta(next);
        const parade = card.parade ?? null;
        if (!parade) return state;
        const obstacles = {
            ...meta.obstacles ?? {}
        };
        const currentObstacle = obstacles[playerId] ?? null;
        const removesObstacle = currentObstacle && _rulebook.CAT_PATTES_OBSTACLE_TO_PARADE[currentObstacle] === parade;
        if (removesObstacle) {
            const obstacleLabel = OBSTACLE_LABELS[currentObstacle] ?? currentObstacle;
            obstacles[playerId] = null;
            meta = {
                ...meta,
                obstacles
            };
            next = this.setMeta(next, meta);
            next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} neutralise ${obstacleLabel} avec ${card.name}.`);
            meta = this.getMeta(next);
        } else if (!currentObstacle && parade === 'rayon') {
        // Rayon autorisé sans obstacle (début de manche / après parade).
        } else {
            return state;
        }
        if (parade === 'rayon') {
            const hasSun = {
                ...meta.hasSun ?? {}
            };
            const alreadyActive = Boolean(hasSun[playerId]);
            hasSun[playerId] = true;
            const sunReady = {
                ...meta.sunReady ?? {}
            };
            sunReady[playerId] = false;
            const obstacleLock = {
                ...meta.obstacleLock ?? {}
            };
            obstacleLock[playerId] = false;
            meta = {
                ...meta,
                hasSun,
                sunReady,
                obstacleLock
            };
            next = this.setMeta(next, meta);
            next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} ${alreadyActive ? 'a déjà le soleil actif.' : 'active le soleil.'}`);
            return next;
        }
        if (removesObstacle) {
            const sunReady = {
                ...meta.sunReady ?? {}
            };
            sunReady[playerId] = true;
            const obstacleLock = {
                ...meta.obstacleLock ?? {}
            };
            obstacleLock[playerId] = true;
            next = this.setMeta(next, {
                ...meta,
                sunReady,
                obstacleLock
            });
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
        const effect = BOT_EFFECTS[bot];
        if (effect) {
            next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} : ${effect}`);
        }
        const currentObstacle = meta.obstacles?.[playerId] ?? null;
        if (currentObstacle && (bot === 'reserve' && currentObstacle === 'gamelle' || bot === 'chat-ninja' && currentObstacle === 'chien' || bot === 'patte-blindee' && currentObstacle === 'coussin' || bot === 'passage-star' && (currentObstacle === 'pluie' || currentObstacle === 'sol'))) {
            const obstacles = {
                ...meta.obstacles ?? {}
            };
            obstacles[playerId] = null;
            const sunReady = {
                ...meta.sunReady ?? {}
            };
            sunReady[playerId] = true;
            const obstacleLock = {
                ...meta.obstacleLock ?? {}
            };
            obstacleLock[playerId] = bot === 'passage-star' ? false : true;
            next = this.setMeta(next, {
                ...meta,
                bots,
                obstacles,
                sunReady,
                obstacleLock
            });
        }
        return next;
    }
    appendPlayedCardNarration(state, playerId, card) {
        let next = this.core.appendLog(state, `${(0, _playernamehelper.resolvePlayerNameFromState)(state, playerId)} joue ${card.name}.`);
        const description = String(card.description ?? '').trim();
        if (description) {
            next = this.core.appendLog(next, description);
        }
        const effect = String(card.effect ?? '').trim();
        if (effect) {
            next = this.core.appendLog(next, effect);
        }
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
        if ((meta.setupStep ?? '') === 'setup_config') return state;
        const hasAssignedPawn = (playerId)=>{
            if (meta.pawnByPlayerId?.[playerId]) return true;
            const player = players.find((p)=>Number(p?.id) === Number(playerId));
            const playerPawn = typeof player?.pawn === 'string' ? player.pawn.trim() : '';
            return playerPawn.length > 0;
        };
        const needsPawn = (player)=>!this.isBotLike(player) && !hasAssignedPawn(Number(player?.id));
        const missingHumans = players.filter((player)=>needsPawn(player));
        if (!missingHumans.length) {
            const clearedState = state.pending?.type === 'choose_pawn' ? {
                ...state,
                pending: null
            } : state;
            if ((meta.setupStep ?? '') !== 'playing') {
                return this.setMeta(clearedState, {
                    ...this.getMeta(clearedState),
                    setupStep: 'playing'
                });
            }
            return clearedState;
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
            next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, player.id)} a choisi le pion : ${nextPawn}.`);
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
    getGoalPattes(meta) {
        const parsed = Number(meta.goalPattes ?? _catpattesstateentity.CAT_PATTES_GOAL);
        if (!Number.isFinite(parsed)) return _catpattesstateentity.CAT_PATTES_GOAL;
        const rounded = Math.round(parsed);
        if (rounded < 600 || rounded > 1500) return _catpattesstateentity.CAT_PATTES_GOAL;
        return rounded;
    }
    getPointsToWin(meta) {
        const parsed = Number(meta.pointsToWin ?? _catpattesstateentity.CAT_PATTES_POINTS_TO_WIN);
        if (!Number.isFinite(parsed)) return _catpattesstateentity.CAT_PATTES_POINTS_TO_WIN;
        const rounded = Math.round(parsed);
        if (rounded < 1000 || rounded > 20000) return _catpattesstateentity.CAT_PATTES_POINTS_TO_WIN;
        return rounded;
    }
    startNextRound(state, roundWinnerId) {
        const meta = this.getMeta(state);
        const players = Array.isArray(state.players) ? state.players.filter((p)=>p?.id != null) : [];
        const playerIds = players.map((p)=>Number(p.id));
        const deck = Object.keys(_catpattescards.CAT_PATTES_CARD_BY_ID);
        const shuffled = this.random.shuffle(meta, deck);
        const remainingDeck = Array.isArray(shuffled.values) ? [
            ...shuffled.values
        ] : [];
        const hands = {};
        const positions = {};
        const obstacles = {};
        const bots = {};
        const hasSun = {};
        const sunReady = {};
        const obstacleLock = {};
        const turboPlayed = {};
        for (const playerId of playerIds){
            positions[playerId] = 0;
            obstacles[playerId] = null;
            bots[playerId] = [];
            hasSun[playerId] = false;
            sunReady[playerId] = true;
            obstacleLock[playerId] = false;
            turboPlayed[playerId] = 0;
            const hand = [];
            for(let i = 0; i < 6; i += 1){
                if (!remainingDeck.length) break;
                hand.push(remainingDeck.shift());
            }
            hands[playerId] = hand;
        }
        const starterId = playerIds.includes(roundWinnerId) ? roundWinnerId : playerIds[0] ?? roundWinnerId;
        const starterIndex = players.findIndex((p)=>Number(p?.id) === starterId);
        let next = this.setMeta(state, {
            ...meta,
            rng: shuffled.meta?.rng ?? meta.rng,
            deck: remainingDeck,
            discard: [],
            hands,
            positions,
            obstacles,
            bots,
            hasSun,
            sunReady,
            obstacleLock,
            turboPlayed,
            setupStep: 'playing',
            setupStarterId: starterId,
            drawnPlayerId: null,
            winnerId: null
        });
        next = {
            ...next,
            pending: null,
            turnIndex: starterIndex >= 0 ? starterIndex : next.turnIndex,
            turn: {
                ...next.turn ?? {
                    direction: 1
                },
                currentPlayerId: starterId,
                direction: 1
            }
        };
        next = this.core.appendLog(next, `Nouvelle manche : ${(0, _playernamehelper.resolvePlayerNameFromState)(next, starterId)} commence.`);
        return this.getTurnPolicies().appendTurnAnnouncement(next, starterId, (s, id)=>(0, _playernamehelper.resolvePlayerNameFromState)(s, id));
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
