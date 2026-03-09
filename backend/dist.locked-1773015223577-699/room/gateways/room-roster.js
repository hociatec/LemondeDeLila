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
    get addHiddenSelf () {
        return addHiddenSelf;
    },
    get listConnectedPlayers () {
        return listConnectedPlayers;
    },
    get listVisibleSpectators () {
        return listVisibleSpectators;
    },
    get mergePlayers () {
        return mergePlayers;
    }
});
function listVisibleSpectators(clients, roomId) {
    const unique = new Map();
    for (const meta of clients){
        if (meta.roomId !== roomId) continue;
        if (meta.role !== 'spectator') continue;
        if (meta.silent) continue;
        unique.set(meta.userId, meta.username || `User ${meta.userId}`);
    }
    return Array.from(unique.entries()).map(([id, username])=>({
            id,
            username
        }));
}
function listConnectedPlayers(clients, roomId) {
    const unique = new Map();
    for (const meta of clients){
        if (meta.roomId !== roomId) continue;
        if (meta.role !== 'participant') continue;
        if (meta.silent) continue;
        unique.set(meta.userId, meta.username || `User ${meta.userId}`);
    }
    return Array.from(unique.entries()).map(([id, username])=>({
            id,
            username
        }));
}
function mergePlayers(dbPlayers, connectedPlayers) {
    const merged = new Map();
    for (const p of dbPlayers ?? [])merged.set(p.id, p.username);
    for (const p of connectedPlayers ?? [])merged.set(p.id, p.username);
    return Array.from(merged.entries()).map(([id, username])=>({
            id,
            username
        }));
}
function addHiddenSelf(spectators, hiddenSelf) {
    if (!hiddenSelf) return spectators;
    const unique = new Map();
    for (const s of spectators ?? [])unique.set(s.id, s.username);
    unique.set(hiddenSelf.userId, hiddenSelf.username);
    return Array.from(unique.entries()).map(([id, username])=>({
            id,
            username
        }));
}
