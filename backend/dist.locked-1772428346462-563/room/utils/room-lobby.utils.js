"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "buildPublicRoomList", {
    enumerable: true,
    get: function() {
        return buildPublicRoomList;
    }
});
const _roomstatusconstants = require("../constants/room-status.constants");
function isRoomOpenStatus(status) {
    const normalized = typeof status === 'string' ? status.toLowerCase() : '';
    return _roomstatusconstants.OPEN_ROOM_STATUSES.includes(normalized);
}
function countActiveParticipants(room) {
    const active = (room.participants || []).filter((p)=>!p.leftAt);
    const activeCount = active.length;
    const ownerId = room.owner?.id;
    if (!ownerId) return activeCount;
    const ownerAlreadyCounted = active.some((p)=>p?.user?.id === ownerId);
    return ownerAlreadyCounted ? activeCount : activeCount + 1;
}
function buildPublicRoomList(rooms, opts) {
    const allowedGameTypes = opts?.allowedGameTypes;
    const items = rooms.filter((room)=>{
        if (!room.gameType || !room.gameType.trim()) {
            return false;
        }
        if (allowedGameTypes && !allowedGameTypes.has(room.gameType)) {
            return false;
        }
        if (room.isPrivate) {
            return false;
        }
        if (room.startedAt) {
            // Table en cours : listée pour spectateurs (même si pleine / status non "open").
            return true;
        }
        // Table en attente : listée si elle est "open".
        // Même si la table est pleine, on veut l'afficher : elle est alors rejoignable en spectateur.
        return isRoomOpenStatus(room.status);
    }).map((room)=>{
        const playersCount = countActiveParticipants(room);
        const botsCount = (room.bots || []).length;
        const started = !!room.startedAt;
        return {
            id: room.id,
            name: room.name,
            gameType: room.gameType,
            status: room.status,
            started,
            spectatorOnly: started,
            maxPlayers: room.maxPlayers,
            playersCount,
            botsCount,
            owner: room.owner ? {
                id: room.owner.id,
                username: room.owner.username
            } : null
        };
    });
    const grouped = new Map();
    for (const item of items){
        const key = item.gameType || '';
        const existing = grouped.get(key);
        if (existing) {
            existing.push(item);
        } else {
            grouped.set(key, [
                item
            ]);
        }
    }
    const groups = Array.from(grouped.entries()).sort(([a], [b])=>a.localeCompare(b, undefined, {
            sensitivity: 'base'
        })).map(([gameType, groupRooms])=>({
            gameType,
            rooms: groupRooms
        }));
    return {
        items,
        groups
    };
}
