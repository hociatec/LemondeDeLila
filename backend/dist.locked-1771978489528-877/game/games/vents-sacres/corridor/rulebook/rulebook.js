"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMetadata = getMetadata;
exports.clampInt = clampInt;
exports.isInside = isInside;
exports.key = key;
exports.parseKey = parseKey;
exports.getPawnPos = getPawnPos;
exports.isOccupied = isOccupied;
exports.wallSets = wallSets;
exports.isEdgeBlocked = isEdgeBlocked;
exports.listLegalPawnMoves = listLegalPawnMoves;
exports.isWinningPos = isWinningPos;
exports.isWallPlacementInBounds = isWallPlacementInBounds;
exports.overlapsOrCrosses = overlapsOrCrosses;
exports.hasPathToGoal = hasPathToGoal;
exports.shortestDistanceToGoal = shortestDistanceToGoal;
exports.wouldBlockAllPaths = wouldBlockAllPaths;
exports.applyWall = applyWall;
exports.listLegalWallPlacements = listLegalWallPlacements;
exports.validateMoveAction = validateMoveAction;
exports.validatePlaceWallAction = validatePlaceWallAction;
function getMetadata(state) {
    return (state.metadata ?? {});
}
function clampInt(n) {
    const v = Number(n);
    return Number.isFinite(v) ? Math.trunc(v) : 0;
}
function isInside(size, pos) {
    return pos.x >= 0 && pos.y >= 0 && pos.x < size && pos.y < size;
}
function key(x, y) {
    return `${x},${y}`;
}
function parseKey(k) {
    const parts = String(k ?? '').split(',');
    if (parts.length !== 2)
        return null;
    const x = Number(parts[0]);
    const y = Number(parts[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y))
        return null;
    return { x: Math.trunc(x), y: Math.trunc(y) };
}
function getPawnPos(meta, playerId) {
    const raw = meta?.pawnsByPlayerId?.[String(playerId)];
    return raw && Number.isFinite(raw.x) && Number.isFinite(raw.y)
        ? { x: raw.x, y: raw.y }
        : { x: 0, y: 0 };
}
function isOccupied(meta, pos) {
    const byId = meta?.pawnsByPlayerId ?? {};
    return Object.values(byId).some((p) => p && p.x === pos.x && p.y === pos.y);
}
function wallSets(meta) {
    return {
        h: new Set((meta?.walls?.h ?? []).map((s) => String(s))),
        v: new Set((meta?.walls?.v ?? []).map((s) => String(s))),
    };
}
function hasHorizontalWallAt(meta, x, y) {
    return wallSets(meta).h.has(key(x, y));
}
function hasVerticalWallAt(meta, x, y) {
    return wallSets(meta).v.has(key(x, y));
}
function isEdgeBlocked(meta, from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    if (Math.abs(dx) + Math.abs(dy) !== 1) {
        return true;
    }
    if (dy === 1) {
        const y = from.y;
        const x = from.x;
        return (hasHorizontalWallAt(meta, x, y) || hasHorizontalWallAt(meta, x - 1, y));
    }
    if (dy === -1) {
        const y = to.y;
        const x = from.x;
        return (hasHorizontalWallAt(meta, x, y) || hasHorizontalWallAt(meta, x - 1, y));
    }
    if (dx === 1) {
        const x = from.x;
        const y = from.y;
        return hasVerticalWallAt(meta, x, y) || hasVerticalWallAt(meta, x, y - 1);
    }
    const x = to.x;
    const y = from.y;
    return hasVerticalWallAt(meta, x, y) || hasVerticalWallAt(meta, x, y - 1);
}
function listLegalPawnMoves(state, actorId) {
    const meta = getMetadata(state);
    const size = meta?.size ?? 0;
    if (!size)
        return [];
    const players = state.players ?? [];
    const otherId = players.find((p) => p?.id !== actorId)?.id ?? null;
    const from = getPawnPos(meta, actorId);
    const otherPos = otherId ? getPawnPos(meta, otherId) : null;
    const dirs = [
        { x: 1, y: 0 },
        { x: -1, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: -1 },
    ];
    const results = [];
    for (const d of dirs) {
        const step = { x: from.x + d.x, y: from.y + d.y };
        if (!isInside(size, step))
            continue;
        if (isEdgeBlocked(meta, from, step))
            continue;
        if (otherPos && step.x === otherPos.x && step.y === otherPos.y) {
            const jump = { x: step.x + d.x, y: step.y + d.y };
            if (isInside(size, jump) &&
                !isEdgeBlocked(meta, step, jump) &&
                !isOccupied(meta, jump)) {
                results.push(jump);
                continue;
            }
            if (d.x !== 0) {
                for (const dy of [-1, 1]) {
                    const diag = { x: step.x, y: step.y + dy };
                    if (!isInside(size, diag))
                        continue;
                    if (isEdgeBlocked(meta, step, diag))
                        continue;
                    if (isOccupied(meta, diag))
                        continue;
                    results.push(diag);
                }
            }
            else {
                for (const dx of [-1, 1]) {
                    const diag = { x: step.x + dx, y: step.y };
                    if (!isInside(size, diag))
                        continue;
                    if (isEdgeBlocked(meta, step, diag))
                        continue;
                    if (isOccupied(meta, diag))
                        continue;
                    results.push(diag);
                }
            }
            continue;
        }
        if (isOccupied(meta, step))
            continue;
        results.push(step);
    }
    const seen = new Set();
    return results.filter((p) => {
        const k = key(p.x, p.y);
        if (seen.has(k))
            return false;
        seen.add(k);
        return true;
    });
}
function isWinningPos(state, playerId, pos) {
    const meta = getMetadata(state);
    const size = meta?.size ?? 0;
    if (!size)
        return false;
    const players = state.players ?? [];
    const idx = players.findIndex((p) => p?.id === playerId);
    if (idx < 0)
        return false;
    const goalY = idx === 0 ? size - 1 : 0;
    return pos.y === goalY;
}
function isWallPlacementInBounds(meta, wall) {
    const size = meta?.size ?? 0;
    if (!size)
        return false;
    return (wall.x >= 0 &&
        wall.y >= 0 &&
        wall.x <= size - 2 &&
        wall.y <= size - 2 &&
        (wall.o === 'h' || wall.o === 'v'));
}
function overlapsOrCrosses(meta, wall) {
    const sets = wallSets(meta);
    const k = key(wall.x, wall.y);
    if (wall.o === 'h') {
        if (sets.h.has(k))
            return true;
        if (sets.v.has(k))
            return true;
        return false;
    }
    if (sets.v.has(k))
        return true;
    if (sets.h.has(k))
        return true;
    return false;
}
function hasPathToGoal(meta, start, goalY) {
    const size = meta?.size ?? 0;
    const q = [start];
    const seen = new Set([key(start.x, start.y)]);
    while (q.length) {
        const cur = q.shift();
        if (cur.y === goalY)
            return true;
        for (const d of [
            { x: 1, y: 0 },
            { x: -1, y: 0 },
            { x: 0, y: 1 },
            { x: 0, y: -1 },
        ]) {
            const nxt = { x: cur.x + d.x, y: cur.y + d.y };
            if (!isInside(size, nxt))
                continue;
            if (isEdgeBlocked(meta, cur, nxt))
                continue;
            const k = key(nxt.x, nxt.y);
            if (seen.has(k))
                continue;
            seen.add(k);
            q.push(nxt);
        }
    }
    return false;
}
function shortestDistanceToGoal(meta, start, goalY) {
    const size = meta?.size ?? 0;
    if (!size)
        return null;
    if (!isInside(size, start))
        return null;
    const q = [{ pos: start, d: 0 }];
    const seen = new Set([key(start.x, start.y)]);
    while (q.length) {
        const cur = q.shift();
        if (cur.pos.y === goalY)
            return cur.d;
        for (const dir of [
            { x: 1, y: 0 },
            { x: -1, y: 0 },
            { x: 0, y: 1 },
            { x: 0, y: -1 },
        ]) {
            const nxt = { x: cur.pos.x + dir.x, y: cur.pos.y + dir.y };
            if (!isInside(size, nxt))
                continue;
            if (isEdgeBlocked(meta, cur.pos, nxt))
                continue;
            const k = key(nxt.x, nxt.y);
            if (seen.has(k))
                continue;
            seen.add(k);
            q.push({ pos: nxt, d: cur.d + 1 });
        }
    }
    return null;
}
function wouldBlockAllPaths(state, meta, wall) {
    const players = state.players ?? [];
    if (players.length < 2)
        return true;
    const p1 = players[0];
    const p2 = players[1];
    const size = meta?.size ?? 0;
    if (!size)
        return true;
    const tmp = applyWall(meta, wall);
    const p1pos = getPawnPos(tmp, p1.id);
    const p2pos = getPawnPos(tmp, p2.id);
    const ok1 = hasPathToGoal(tmp, p1pos, size - 1);
    const ok2 = hasPathToGoal(tmp, p2pos, 0);
    return !(ok1 && ok2);
}
function applyWall(meta, wall) {
    const next = {
        ...meta,
        walls: { h: [...(meta?.walls?.h ?? [])], v: [...(meta?.walls?.v ?? [])] },
    };
    const k = key(wall.x, wall.y);
    if (wall.o === 'h') {
        if (!next.walls.h.includes(k))
            next.walls.h.push(k);
    }
    else {
        if (!next.walls.v.includes(k))
            next.walls.v.push(k);
    }
    return next;
}
function listLegalWallPlacements(state, actorId) {
    const meta = getMetadata(state);
    const remaining = (meta?.wallsRemainingByPlayerId ?? {})[String(actorId)] ?? 0;
    if (!remaining)
        return [];
    const size = meta?.size ?? 0;
    if (!size)
        return [];
    const results = [];
    for (const o of ['h', 'v']) {
        for (let y = 0; y <= size - 2; y++) {
            for (let x = 0; x <= size - 2; x++) {
                const wall = { x, y, o };
                if (!isWallPlacementInBounds(meta, wall))
                    continue;
                if (overlapsOrCrosses(meta, wall))
                    continue;
                if (wouldBlockAllPaths(state, meta, wall))
                    continue;
                results.push(wall);
            }
        }
    }
    return results;
}
function validateMoveAction(state, action, actorId) {
    if (actorId == null) {
        throw new Error('Acteur requis');
    }
    if ((action?.type ?? '').trim() !== 'corridor_move') {
        throw new Error(`Action inconnue: ${action?.type ?? ''}`);
    }
    const payload = (action.payload ?? {});
    const x = clampInt(payload?.x);
    const y = clampInt(payload?.y);
    const legal = listLegalPawnMoves(state, actorId).some((p) => p.x === x && p.y === y);
    if (!legal) {
        throw new Error('Déplacement illégal');
    }
    return { to: { x, y }, actorId };
}
function validatePlaceWallAction(state, action, actorId) {
    if (actorId == null) {
        throw new Error('Acteur requis');
    }
    if ((action?.type ?? '').trim() !== 'corridor_place_wall') {
        throw new Error(`Action inconnue: ${action?.type ?? ''}`);
    }
    const payload = (action.payload ?? {});
    const x = clampInt(payload?.x);
    const y = clampInt(payload?.y);
    const o = String(payload?.o ?? payload?.orientation ?? '')
        .trim()
        .toLowerCase();
    const orientation = o === 'v' || o === 'vertical'
        ? 'v'
        : o === 'h' || o === 'horizontal'
            ? 'h'
            : (() => {
                throw new Error('Orientation invalide');
            })();
    const meta = getMetadata(state);
    const remaining = (meta?.wallsRemainingByPlayerId ?? {})[String(actorId)] ?? 0;
    if (remaining <= 0) {
        throw new Error('Aucun mur restant.');
    }
    const wall = { x, y, o: orientation };
    if (!isWallPlacementInBounds(meta, wall)) {
        throw new Error('Position de mur invalide.');
    }
    if (overlapsOrCrosses(meta, wall)) {
        throw new Error('Mur invalide (chevauchement/croisement).');
    }
    if (wouldBlockAllPaths(state, meta, wall)) {
        throw new Error('Mur invalide (bloque un chemin).');
    }
    return { wall, actorId };
}
//# sourceMappingURL=rulebook.js.map