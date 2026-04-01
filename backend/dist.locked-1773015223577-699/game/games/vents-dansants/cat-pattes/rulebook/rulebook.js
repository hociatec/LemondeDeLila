"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: Object.getOwnPropertyDescriptor(all, name).get
    });
}
_export(exports, {
    get CAT_PATTES_OBSTACLE_TO_PARADE () {
        return CAT_PATTES_OBSTACLE_TO_PARADE;
    },
    get canPlayBot () {
        return canPlayBot;
    },
    get canPlayParade () {
        return canPlayParade;
    },
    get canPlayPattes () {
        return canPlayPattes;
    },
    get getAvailableActions () {
        return getAvailableActions;
    },
    get isBlockedByObstacle () {
        return isBlockedByObstacle;
    },
    get playerCanReceiveObstacle () {
        return playerCanReceiveObstacle;
    },
    get validateAction () {
        return validateAction;
    }
});
const _catpattescards = require("../model/cat-pattes-cards");
const _catpattesstateentity = require("../model/cat-pattes-state.entity");
const _actionservicehelper = require("../../../../actions/action-service.helper");
const _rulebookguardhelper = require("../../../../rulebook/rulebook-guard.helper");
const _pawnpendingrulebookhelper = require("../../../../core/helpers/pawn-pending-rulebook.helper");
const _stringvalueutils = require("../../../../../common/utils/string-value.utils");
function getMeta(state) {
    return state.metadata ?? {};
}
function getGoalPattes(meta) {
    const parsed = Number(meta.goalPattes ?? _catpattesstateentity.CAT_PATTES_GOAL);
    if (!Number.isFinite(parsed)) return _catpattesstateentity.CAT_PATTES_GOAL;
    const rounded = Math.round(parsed);
    if (rounded <= 0) return _catpattesstateentity.CAT_PATTES_GOAL;
    return rounded;
}
const CAT_PATTES_OBSTACLE_TO_PARADE = {
    gamelle: 'croquettes',
    pluie: 'rayon',
    chien: 'dodo',
    coussin: 'coussin',
    sol: 'saut'
};
const PARADE_DISABLED_BY_BOT = {
    reserve: [
        'croquettes'
    ],
    'chat-ninja': [
        'dodo'
    ],
    'patte-blindee': [
        'coussin'
    ],
    'passage-star': [
        'rayon',
        'saut'
    ]
};
function hasBot(bots, type) {
    return Array.isArray(bots) && bots.includes(type);
}
function getBots(meta, playerId) {
    return Array.isArray(meta.bots?.[playerId]) ? meta.bots[playerId] : [];
}
function getSunReady(meta, playerId) {
    if (meta.sunReady?.[playerId] == null) return true;
    return Boolean(meta.sunReady[playerId]);
}
function obstacleLocked(meta, playerId) {
    if (meta.obstacleLock?.[playerId] == null) return false;
    return Boolean(meta.obstacleLock[playerId]);
}
function botCountersObstacle(bot, obstacle) {
    if (bot === 'reserve') return obstacle === 'gamelle';
    if (bot === 'chat-ninja') return obstacle === 'chien';
    if (bot === 'patte-blindee') return obstacle === 'coussin';
    if (bot === 'passage-star') return obstacle === 'pluie' || obstacle === 'sol';
    return false;
}
function isParadeDisabledByBots(bots, parade) {
    if (!parade) return false;
    return bots.some((bot)=>PARADE_DISABLED_BY_BOT[bot]?.includes(parade));
}
function obstacleIsIgnoredByBots(obstacle, bots) {
    if (obstacle === 'gamelle' && hasBot(bots, 'reserve')) {
        return true;
    }
    if (obstacle === 'chien' && hasBot(bots, 'chat-ninja')) {
        return true;
    }
    if (obstacle === 'coussin' && hasBot(bots, 'patte-blindee')) {
        return true;
    }
    if ((obstacle === 'pluie' || obstacle === 'sol') && hasBot(bots, 'passage-star')) {
        return true;
    }
    return false;
}
function isBlockedByObstacle(meta, playerId) {
    const obstacle = meta.obstacles?.[playerId] ?? null;
    if (!obstacle) return false;
    const bots = getBots(meta, playerId);
    return !obstacleIsIgnoredByBots(obstacle, bots);
}
function samePlayerId(a, b) {
    const left = Number(a);
    const right = Number(b);
    return Number.isFinite(left) && Number.isFinite(right) && left === right;
}
function canPlayPattes(meta, playerId, card) {
    const hasSun = Boolean(meta.hasSun?.[playerId]);
    const bots = meta.bots?.[playerId] ?? [];
    const obstacle = meta.obstacles?.[playerId] ?? null;
    const passageStar = hasBot(bots, 'passage-star');
    if (!hasSun && !passageStar) {
        return false;
    }
    if (obstacle && !obstacleIsIgnoredByBots(obstacle, bots)) {
        return false;
    }
    const currentPos = Number(meta.positions?.[playerId] ?? 0);
    const delta = Number(card.value ?? 0);
    if (!Number.isFinite(delta) || delta <= 0) return false;
    return currentPos + delta <= getGoalPattes(meta);
}
function playerCanReceiveObstacle(meta, playerId, obstacle) {
    const bots = meta.bots?.[playerId] ?? [];
    if (obstacleIsIgnoredByBots(obstacle, bots)) {
        return false;
    }
    if (obstacleLocked(meta, playerId) && !hasBot(bots, 'passage-star')) {
        return false;
    }
    return !meta.obstacles?.[playerId];
}
function canPlayParade(meta, playerId, card) {
    const parade = card.parade ?? null;
    if (!parade) return false;
    const bots = getBots(meta, playerId);
    if (isParadeDisabledByBots(bots, parade)) return false;
    const obstacle = meta.obstacles?.[playerId] ?? null;
    if (obstacle && CAT_PATTES_OBSTACLE_TO_PARADE[obstacle] === parade) {
        return true;
    }
    if (!obstacle && parade === 'rayon') {
        return getSunReady(meta, playerId);
    }
    return false;
}
function canPlayBot(meta, playerId, card) {
    const bot = card.bot;
    if (!bot) return false;
    const obstacle = meta.obstacles?.[playerId] ?? null;
    if (!obstacle) return true;
    return botCountersObstacle(bot, obstacle);
}
function normalizePawnKey(value) {
    return (0, _stringvalueutils.stringOrEmpty)(value).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '');
}
function getAvailableActions(state, playerId) {
    if (!(0, _rulebookguardhelper.isStartedState)(state)) return [];
    const meta = getMeta(state);
    if ((meta.setupStep ?? '') === 'setup_config') {
        if (meta.ownerPlayerId != null && samePlayerId(meta.ownerPlayerId, playerId)) {
            return [
                {
                    type: 'cat_pattes_set_config',
                    payload: {}
                }
            ];
        }
        return [];
    }
    const pending = state.pending;
    if (pending) {
        const pawnActions = (0, _pawnpendingrulebookhelper.getPendingPawnActionsForPlayer)(pending, playerId, 'choose_pawn');
        if (pawnActions.length > 0) {
            return pawnActions;
        }
        return [];
    }
    const current = state.turn?.currentPlayerId ?? null;
    if (!samePlayerId(current, playerId)) return [];
    if (!samePlayerId(meta.drawnPlayerId, playerId)) {
        return [
            {
                type: 'draw',
                payload: {}
            }
        ];
    }
    const hand = Array.isArray(meta.hands?.[playerId]) ? [
        ...meta.hands[playerId]
    ] : [];
    const actions = [];
    const blockedByObstacle = isBlockedByObstacle(meta, playerId);
    const opponents = (Array.isArray(state.players) ? state.players : []).filter((p)=>p?.id != null && p.id !== playerId).map((p)=>p.id);
    const counterActions = [];
    for (const cardId of hand){
        const definition = _catpattescards.CAT_PATTES_CARD_BY_ID[cardId];
        if (!definition) continue;
        if (definition.type === 'pattes') {
            if (blockedByObstacle) {
                continue;
            }
            if (!canPlayPattes(meta, playerId, definition)) {
                continue;
            }
            actions.push({
                type: 'play_card',
                payload: {
                    cardId
                }
            });
            actions.push({
                type: 'discard_card',
                payload: {
                    cardId
                }
            });
            continue;
        }
        if (definition.type === 'obstacle') {
            if (blockedByObstacle) {
                continue;
            }
            for (const target of opponents){
                if (!playerCanReceiveObstacle(meta, target, definition.obstacle)) {
                    continue;
                }
                actions.push({
                    type: 'play_card',
                    payload: {
                        cardId,
                        targetPlayerId: target
                    }
                });
            }
            actions.push({
                type: 'discard_card',
                payload: {
                    cardId
                }
            });
            continue;
        }
        if (definition.type === 'parade') {
            if (canPlayParade(meta, playerId, definition)) {
                const play = {
                    type: 'play_card',
                    payload: {
                        cardId
                    }
                };
                actions.push(play);
                if (blockedByObstacle) {
                    counterActions.push(play);
                }
            }
            actions.push({
                type: 'discard_card',
                payload: {
                    cardId
                }
            });
            continue;
        }
        if (definition.type === 'bot') {
            if (canPlayBot(meta, playerId, definition)) {
                const play = {
                    type: 'play_card',
                    payload: {
                        cardId
                    }
                };
                actions.push(play);
                if (blockedByObstacle) {
                    counterActions.push(play);
                }
            }
            actions.push({
                type: 'discard_card',
                payload: {
                    cardId
                }
            });
        }
    }
    if (blockedByObstacle && counterActions.length > 0) {
        return counterActions;
    }
    if (actions.length === 0) {
        return [
            {
                type: 'pass',
                payload: {}
            }
        ];
    }
    return actions;
}
function validateAction(state, action, actorId) {
    const type = (0, _actionservicehelper.normalizeActionType)(action);
    const payload = action?.payload ?? {};
    if (type !== 'play_card' && type !== 'discard_card' && type !== 'draw' && type !== 'choose_pawn' && type !== 'cat_pattes_set_config' && type !== 'pass') {
        throw new Error(`Action inconnue: ${type}`);
    }
    if (actorId == null) {
        throw new Error('Acteur requis');
    }
    const status = String(state.status ?? '').toLowerCase();
    if (status !== 'started') {
        throw new Error("La partie n'est pas démarrée.");
    }
    const meta = getMeta(state);
    if ((meta.setupStep ?? '') === 'setup_config') {
        if (type !== 'cat_pattes_set_config') {
            throw new Error('Configuration requise avant de commencer.');
        }
        if (!samePlayerId(meta.ownerPlayerId, actorId)) {
            throw new Error('Seul le propriétaire de la table peut configurer.');
        }
        const roundsRaw = Number(payload.roundsToPlay ?? payload.value ?? null);
        if (!Number.isFinite(roundsRaw)) {
            throw new Error('Nombre de manches invalide.');
        }
        const roundsToPlay = Math.round(roundsRaw);
        if (roundsToPlay < 1 || roundsToPlay > 20) {
            throw new Error('Nombre de manches hors limites (1-20).');
        }
        return {
            type: 'cat_pattes_set_config',
            payload: {
                roundsToPlay
            }
        };
    }
    const pending = state.pending;
    if (pending) {
        const pawnValidation = (0, _pawnpendingrulebookhelper.validatePendingPawnActionForActor)({
            pending,
            actorId,
            actionType: type,
            payload,
            pendingType: 'choose_pawn',
            idResolver: (value)=>normalizePawnKey(value)
        });
        if (pawnValidation.ok) {
            return pawnValidation.action;
        }
        if (pawnValidation.reason === 'wrong_action_type') {
            throw new Error('Action indisponible (choix de pion requis).');
        }
        if (pawnValidation.reason === 'invalid_pawn') {
            throw new Error('Pion invalide.');
        }
        throw new Error('Action indisponible (choix en attente).');
    }
    const current = state.turn?.currentPlayerId ?? null;
    if (!samePlayerId(current, actorId)) {
        throw new Error("Ce n'est pas votre tour.");
    }
    if (!samePlayerId(meta.drawnPlayerId, actorId)) {
        if (type !== 'draw') {
            throw new Error("Vous devez d'abord piocher.");
        }
        return {
            type: 'draw',
            payload: {}
        };
    }
    if (type === 'draw') {
        throw new Error('Carte déjà piochée ce tour.');
    }
    if (type === 'pass') {
        return {
            type: 'discard_card',
            payload: {}
        };
    }
    const cardId = String(payload.cardId ?? '').trim();
    if (!cardId && type === 'play_card') {
        // Robust fallback: if the client sends a play action without cardId, discard instead.
        return {
            type: 'discard_card',
            payload: {}
        };
    }
    if (!cardId && type !== 'discard_card') {
        throw new Error('Carte introuvable.');
    }
    const hand = Array.isArray(meta.hands?.[actorId]) ? meta.hands[actorId] : [];
    const blockedByObstacle = isBlockedByObstacle(meta, actorId);
    const hasCounterInHand = ()=>{
        for (const id of hand){
            const def = _catpattescards.CAT_PATTES_CARD_BY_ID[id];
            if (!def) continue;
            if (def.type === 'parade' && canPlayParade(meta, actorId, def)) return true;
            if (def.type === 'bot' && canPlayBot(meta, actorId, def)) return true;
        }
        return false;
    };
    if (type === 'discard_card') {
        if (blockedByObstacle && hasCounterInHand()) {
            throw new Error('Un obstacle actif vous bloque: vous devez contrer avec une Parade ou un Pouvoir.');
        }
        if (!cardId) {
            return {
                type: 'discard_card',
                payload: {}
            };
        }
        if (!hand.includes(cardId)) {
            throw new Error('Carte indisponible.');
        }
        return {
            type: 'discard_card',
            payload: {
                cardId
            }
        };
    }
    if (!hand.includes(cardId)) {
        throw new Error('Carte indisponible.');
    }
    const definition = _catpattescards.CAT_PATTES_CARD_BY_ID[cardId];
    if (!definition) {
        throw new Error('Carte invalide.');
    }
    if (blockedByObstacle && definition.type !== 'parade' && definition.type !== 'bot') {
        throw new Error('Un obstacle actif vous bloque: jouez une Parade ou un Pouvoir.');
    }
    if (definition.type === 'pattes' && !canPlayPattes(meta, actorId, definition)) {
        const bots = meta.bots?.[actorId] ?? [];
        const passageStar = hasBot(bots, 'passage-star');
        const hasSun = Boolean(meta.hasSun?.[actorId]);
        const obstacle = meta.obstacles?.[actorId] ?? null;
        if (!hasSun && !passageStar) {
            throw new Error('Impossible de jouer Pattes: aucun Rayon de soleil actif.');
        }
        if (obstacle && !obstacleIsIgnoredByBots(obstacle, bots)) {
            throw new Error('Impossible de jouer Pattes: un obstacle vous bloque.');
        }
        const currentPos = Number(meta.positions?.[actorId] ?? 0);
        const delta = Number(definition.value ?? 0);
        if (Number.isFinite(delta) && currentPos + delta > getGoalPattes(meta)) {
            throw new Error(`Impossible de jouer Pattes: depassement de ${getGoalPattes(meta)} pattes.`);
        }
        throw new Error('Impossible de jouer Pattes.');
    }
    if (definition.type === 'obstacle') {
        if (blockedByObstacle) {
            throw new Error('Un obstacle actif vous bloque: vous ne pouvez pas jouer une carte Obstacle.');
        }
        const targetId = typeof payload.targetPlayerId === 'number' ? payload.targetPlayerId : null;
        if (targetId == null) {
            throw new Error('La cible est requise pour une carte Obstacle.');
        }
        if (targetId === actorId) {
            throw new Error("Impossible de s'infliger son propre obstacle.");
        }
        const targetHand = Array.isArray(state.players) ? state.players : [];
        const exists = targetHand.some((p)=>samePlayerId(p?.id, targetId));
        if (!exists) {
            throw new Error('Joueur cible invalide.');
        }
        if (!playerCanReceiveObstacle(meta, targetId, definition.obstacle)) {
            throw new Error('La cible ne peut pas recevoir cet obstacle (deja protegee ou deja un obstacle).');
        }
    }
    if (definition.type === 'parade') {
        if (!canPlayParade(meta, actorId, definition)) {
            throw new Error('Impossible de jouer cette Parade: aucun obstacle correspondant ou soleil non autorisé.');
        }
    }
    if (definition.type === 'bot') {
        if (!canPlayBot(meta, actorId, definition)) {
            throw new Error('Un obstacle actif vous bloque: ce Pouvoir ne le contre pas.');
        }
    }
    return {
        type: 'play_card',
        payload: {
            ...payload,
            cardId
        }
    };
}
