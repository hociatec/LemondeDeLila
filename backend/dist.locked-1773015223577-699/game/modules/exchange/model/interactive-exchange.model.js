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
    get defaultExchangeTargets () {
        return defaultExchangeTargets;
    },
    get defaultGetInventory () {
        return defaultGetInventory;
    }
});
function defaultExchangeTargets(state, playerId) {
    const players = state.players ?? [];
    return players.filter((p)=>p && p.id !== playerId).map((p)=>({
            targetPlayerId: p.id,
            targetUsername: p.username ?? `Joueur ${p.id}`
        }));
}
function defaultGetInventory(state, playerId) {
    const player = (state.players ?? []).find((p)=>p.id === playerId);
    return toStringArray(player?.inventory);
}
function toStringArray(value) {
    if (Array.isArray(value)) {
        return value.map((v)=>v == null ? '' : String(v)).filter((v)=>v.length > 0);
    }
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
                return parsed.map((v)=>v == null ? '' : String(v)).filter((v)=>v.length > 0);
            }
        } catch  {
        /* ignore */ }
        return value.split(/[,;]+/).map((v)=>v.trim()).filter((v)=>v.length > 0);
    }
    return [];
}
