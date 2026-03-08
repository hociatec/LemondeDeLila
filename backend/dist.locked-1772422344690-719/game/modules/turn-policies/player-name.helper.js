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
    get resolvePlayerName () {
        return resolvePlayerName;
    },
    get resolvePlayerNameFromState () {
        return resolvePlayerNameFromState;
    }
});
function resolvePlayerName(players, playerId, options) {
    const safePlayers = Array.isArray(players) ? players : [];
    const match = safePlayers.find((player)=>{
        const id = player?.id;
        if (options?.coerceNumericIds) return Number(id) === playerId;
        return id === playerId;
    });
    let username = match?.username && String(match.username).trim() ? String(match.username).trim() : null;
    if (username && options?.collapseWhitespace) {
        username = username.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
    }
    if (username && options?.unwrapDoubleQuotes) {
        username = username.replace(/^"(.*)"$/u, '$1').trim();
    }
    return username ?? `Joueur ${playerId}`;
}
function resolvePlayerNameFromState(state, playerId, options) {
    return resolvePlayerName(state?.players, playerId, options);
}
