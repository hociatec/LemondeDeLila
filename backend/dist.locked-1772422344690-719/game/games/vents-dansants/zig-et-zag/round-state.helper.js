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
    get buildInitialRoundState () {
        return buildInitialRoundState;
    },
    get getPlayerHand () {
        return getPlayerHand;
    },
    get getPlayerHandSize () {
        return getPlayerHandSize;
    },
    get getSelectableCards () {
        return getSelectableCards;
    },
    get isCardAllowed () {
        return isCardAllowed;
    },
    get playerHasCard () {
        return playerHasCard;
    },
    get removeCardFromHand () {
        return removeCardFromHand;
    }
});
const _zigetzagcards = require("./model/zig-et-zag-cards");
function buildInitialRoundState(metadata, players) {
    const playerIds = players.map((player)=>player?.id).filter((id)=>typeof id === 'number');
    const plays = playerIds.map((playerId)=>({
            playerId,
            playedCards: []
        }));
    const waitingPlayers = playerIds.filter((playerId)=>getPlayerHandSize(metadata, playerId) > 0);
    playerIds.filter((playerId)=>!waitingPlayers.includes(playerId)).forEach((playerId)=>{
        const entry = plays.find((play)=>play.playerId === playerId);
        if (entry) {
            entry.lostByNoCard = true;
        }
    });
    return {
        stage: 'selection',
        plays,
        waitingPlayers,
        tiedPlayers: [],
        triggerColors: {},
        triggerFamilies: {},
        battleLog: []
    };
}
function getPlayerHand(metadata, playerId) {
    const decks = metadata.playerDecks ?? {};
    const hand = Array.isArray(decks[playerId]) ? [
        ...decks[playerId]
    ] : [];
    return hand;
}
function getPlayerHandSize(metadata, playerId) {
    return getPlayerHand(metadata, playerId).length;
}
function playerHasCard(metadata, playerId, cardId) {
    return getPlayerHand(metadata, playerId).includes(cardId);
}
function removeCardFromHand(metadata, playerId, cardId) {
    const decks = {
        ...metadata.playerDecks ?? {}
    };
    const hand = Array.isArray(decks[playerId]) ? [
        ...decks[playerId]
    ] : [];
    const index = hand.indexOf(cardId);
    if (index < 0) {
        return {
            metadata,
            removed: false
        };
    }
    hand.splice(index, 1);
    decks[playerId] = hand;
    return {
        metadata: {
            ...metadata,
            playerDecks: decks
        },
        removed: true
    };
}
function getSelectableCards(metadata, playerId) {
    const round = metadata.roundState;
    if (!round) return [];
    // Robustness: some stores/serializers can round-trip number ids as strings.
    const waiting = (round.waitingPlayers ?? []).map((v)=>{
        if (typeof v === 'number' && Number.isFinite(v)) return v;
        if (typeof v === 'string') {
            const n = Number(v.trim());
            return Number.isFinite(n) ? n : null;
        }
        return null;
    }).filter((v)=>typeof v === 'number');
    if (!waiting.includes(playerId)) return [];
    return getPlayerHand(metadata, playerId).filter((cardId)=>isCardAllowed(round, playerId, cardId));
}
function isCardAllowed(round, playerId, cardId) {
    if (round.stage === 'selection') {
        return true;
    }
    const definition = _zigetzagcards.ZIG_ET_ZAG_CARD_BY_ID[cardId];
    if (!definition) return false;
    if (definition.type !== 'joker') {
        return true;
    }
    const color = round.triggerColors[playerId];
    const family = round.triggerFamilies[playerId];
    if (!color || !family) {
        return false;
    }
    return definition.color === color && Array.isArray(definition.allowedFamilies) && definition.allowedFamilies.includes(family);
}
