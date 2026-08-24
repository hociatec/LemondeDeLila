import type { GameSingleActionDto } from '../../../../application/models/game-action.model';
import type { GameStateEntity } from '../../../../application/models/game-state.model';
import {
  GameActorRequiredError,
  GameActionRejectedError,
  GamePayloadValidationError,
  GameUnknownActionError,
} from '../../../../domain/errors/game-domain.errors';
import type {
  CorridorMetadata,
  CorridorPos,
  CorridorWallOrientation,
} from '../model/corridor.model';

export type CorridorWall = { x: number; y: number; o: CorridorWallOrientation };

type CorridorMovePayload = {
  x?: number | string;
  y?: number | string;
};

type CorridorPlaceWallPayload = CorridorMovePayload & {
  o?: string;
  orientation?: string;
};

export function getMetadata(state: GameStateEntity): CorridorMetadata {
  return (state.metadata ?? {}) as CorridorMetadata;
}

export function clampInt(n: unknown): number {
  const v = Number(n);
  return Number.isFinite(v) ? Math.trunc(v) : 0;
}

export function isInside(size: number, pos: CorridorPos): boolean {
  return pos.x >= 0 && pos.y >= 0 && pos.x < size && pos.y < size;
}

export function key(x: number, y: number): string {
  return `${x},${y}`;
}

export function parseKey(k: string): { x: number; y: number } | null {
  const parts = String(k ?? '').split(',');
  if (parts.length !== 2) return null;
  const x = Number(parts[0]);
  const y = Number(parts[1]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x: Math.trunc(x), y: Math.trunc(y) };
}

export function getPawnPos(
  meta: CorridorMetadata,
  playerId: number,
): CorridorPos {
  const raw = meta?.pawnsByPlayerId?.[String(playerId)];
  return raw && Number.isFinite(raw.x) && Number.isFinite(raw.y)
    ? { x: raw.x, y: raw.y }
    : { x: 0, y: 0 };
}

export function isOccupied(meta: CorridorMetadata, pos: CorridorPos): boolean {
  const byId = meta?.pawnsByPlayerId ?? {};
  return Object.values(byId).some((p) => p && p.x === pos.x && p.y === pos.y);
}

export function wallSets(meta: CorridorMetadata): {
  h: Set<string>;
  v: Set<string>;
} {
  return {
    h: new Set((meta?.walls?.h ?? []).map((s) => String(s))),
    v: new Set((meta?.walls?.v ?? []).map((s) => String(s))),
  };
}

function hasHorizontalWallAt(
  meta: CorridorMetadata,
  x: number,
  y: number,
): boolean {
  // x,y in [0..size-2]
  return wallSets(meta).h.has(key(x, y));
}

function hasVerticalWallAt(
  meta: CorridorMetadata,
  x: number,
  y: number,
): boolean {
  // x,y in [0..size-2]
  return wallSets(meta).v.has(key(x, y));
}

export function isEdgeBlocked(
  meta: CorridorMetadata,
  from: CorridorPos,
  to: CorridorPos,
): boolean {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) + Math.abs(dy) !== 1) {
    return true;
  }

  // Mouvement vertical : vérifier mur horizontal entre les 2 rangées.
  if (dy === 1) {
    // vers le bas, frontière entre y=from.y et y=from.y+1 => wall y=from.y
    const y = from.y;
    const x = from.x;
    return (
      hasHorizontalWallAt(meta, x, y) || hasHorizontalWallAt(meta, x - 1, y)
    );
  }
  if (dy === -1) {
    const y = to.y;
    const x = from.x;
    return (
      hasHorizontalWallAt(meta, x, y) || hasHorizontalWallAt(meta, x - 1, y)
    );
  }

  // Mouvement horizontal : vérifier mur vertical entre les 2 colonnes.
  if (dx === 1) {
    const x = from.x;
    const y = from.y;
    return hasVerticalWallAt(meta, x, y) || hasVerticalWallAt(meta, x, y - 1);
  }
  // dx === -1
  const x = to.x;
  const y = from.y;
  return hasVerticalWallAt(meta, x, y) || hasVerticalWallAt(meta, x, y - 1);
}

export function listLegalPawnMoves(
  state: GameStateEntity,
  actorId: number,
): CorridorPos[] {
  const meta = getMetadata(state);
  const size = meta?.size ?? 0;
  if (!size) return [];

  const players = state.players ?? [];
  const otherId = players.find((p) => p?.id !== actorId)?.id ?? null;
  const from = getPawnPos(meta, actorId);
  const otherPos = otherId ? getPawnPos(meta, otherId) : null;

  const dirs: CorridorPos[] = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ];

  const results: CorridorPos[] = [];

  for (const d of dirs) {
    const step = { x: from.x + d.x, y: from.y + d.y };
    if (!isInside(size, step)) continue;
    if (isEdgeBlocked(meta, from, step)) continue;

    if (otherPos && step.x === otherPos.x && step.y === otherPos.y) {
      // Tentative de saut.
      const jump = { x: step.x + d.x, y: step.y + d.y };
      if (
        isInside(size, jump) &&
        !isEdgeBlocked(meta, step, jump) &&
        !isOccupied(meta, jump)
      ) {
        results.push(jump);
        continue;
      }

      // Sinon diagonales autour du pion adverse.
      if (d.x !== 0) {
        // on allait gauche/droite => diagonales haut/bas depuis step
        for (const dy of [-1, 1]) {
          const diag = { x: step.x, y: step.y + dy };
          if (!isInside(size, diag)) continue;
          if (isEdgeBlocked(meta, step, diag)) continue;
          if (isOccupied(meta, diag)) continue;
          results.push(diag);
        }
      } else {
        // on allait haut/bas => diagonales gauche/droite
        for (const dx of [-1, 1]) {
          const diag = { x: step.x + dx, y: step.y };
          if (!isInside(size, diag)) continue;
          if (isEdgeBlocked(meta, step, diag)) continue;
          if (isOccupied(meta, diag)) continue;
          results.push(diag);
        }
      }
      continue;
    }

    if (isOccupied(meta, step)) continue;
    results.push(step);
  }

  // dédoublonnage
  const seen = new Set<string>();
  return results.filter((p) => {
    const k = key(p.x, p.y);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function isWinningPos(
  state: GameStateEntity,
  playerId: number,
  pos: CorridorPos,
): boolean {
  const goalY = getGoalYForPlayer(state, playerId);
  if (goalY == null) return false;
  return pos.y === goalY;
}

export function getGoalYForPlayer(
  state: GameStateEntity,
  playerId: number,
): number | null {
  const meta = getMetadata(state);
  const size = meta?.size ?? 0;
  if (!size) return null;

  const mappedGoal = meta?.goalYByPlayerId?.[String(playerId)];
  if (Number.isFinite(mappedGoal)) {
    return Math.trunc(Number(mappedGoal));
  }

  // Backward compatibility for legacy states without explicit goals.
  const players = state.players ?? [];
  const idx = players.findIndex((p) => p?.id === playerId);
  if (idx < 0) return null;
  return idx === 0 ? size - 1 : 0;
}

export function isWallPlacementInBounds(
  meta: CorridorMetadata,
  wall: CorridorWall,
): boolean {
  const size = meta?.size ?? 0;
  if (!size) return false;
  return (
    wall.x >= 0 &&
    wall.y >= 0 &&
    wall.x <= size - 2 &&
    wall.y <= size - 2 &&
    (wall.o === 'h' || wall.o === 'v')
  );
}

export function overlapsOrCrosses(
  meta: CorridorMetadata,
  wall: CorridorWall,
): boolean {
  const sets = wallSets(meta);
  const k = key(wall.x, wall.y);
  if (wall.o === 'h') {
    // chevauchement (même spot) uniquement ; l'adjacence est autorisée (mur "collé").
    if (sets.h.has(k)) return true;
    // croisement avec mur vertical au même spot
    if (sets.v.has(k)) return true;
    return false;
  }

  if (sets.v.has(k)) return true;
  if (sets.h.has(k)) return true;
  return false;
}

export function hasPathToGoal(
  meta: CorridorMetadata,
  start: CorridorPos,
  goalY: number,
): boolean {
  const size = meta?.size ?? 0;
  const q: CorridorPos[] = [start];
  const seen = new Set<string>([key(start.x, start.y)]);
  while (q.length) {
    const cur = q.shift() as CorridorPos;
    if (cur.y === goalY) return true;

    for (const d of [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ]) {
      const nxt = { x: cur.x + d.x, y: cur.y + d.y };
      if (!isInside(size, nxt)) continue;
      if (isEdgeBlocked(meta, cur, nxt)) continue;
      const k = key(nxt.x, nxt.y);
      if (seen.has(k)) continue;
      seen.add(k);
      q.push(nxt);
    }
  }
  return false;
}

export function shortestDistanceToGoal(
  meta: CorridorMetadata,
  start: CorridorPos,
  goalY: number,
): number | null {
  const size = meta?.size ?? 0;
  if (!size) return null;
  if (!isInside(size, start)) return null;

  const q: Array<{ pos: CorridorPos; d: number }> = [{ pos: start, d: 0 }];
  const seen = new Set<string>([key(start.x, start.y)]);
  while (q.length) {
    const cur = q.shift() as { pos: CorridorPos; d: number };
    if (cur.pos.y === goalY) return cur.d;

    for (const dir of [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ]) {
      const nxt = { x: cur.pos.x + dir.x, y: cur.pos.y + dir.y };
      if (!isInside(size, nxt)) continue;
      if (isEdgeBlocked(meta, cur.pos, nxt)) continue;
      const k = key(nxt.x, nxt.y);
      if (seen.has(k)) continue;
      seen.add(k);
      q.push({ pos: nxt, d: cur.d + 1 });
    }
  }

  return null;
}

export function wouldBlockAllPaths(
  state: GameStateEntity,
  meta: CorridorMetadata,
  wall: CorridorWall,
): boolean {
  const players = state.players ?? [];
  if (players.length < 2) return true;
  const p1 = players[0];
  const p2 = players[1];
  const size = meta?.size ?? 0;
  if (!size) return true;

  const tmp: CorridorMetadata = applyWall(meta, wall);
  const p1pos = getPawnPos(tmp, p1.id);
  const p2pos = getPawnPos(tmp, p2.id);
  const p1Goal = getGoalYForPlayer(state, p1.id);
  const p2Goal = getGoalYForPlayer(state, p2.id);
  if (p1Goal == null || p2Goal == null) return true;
  const ok1 = hasPathToGoal(tmp, p1pos, p1Goal);
  const ok2 = hasPathToGoal(tmp, p2pos, p2Goal);
  return !(ok1 && ok2);
}

export function applyWall(
  meta: CorridorMetadata,
  wall: CorridorWall,
): CorridorMetadata {
  const next: CorridorMetadata = {
    ...meta,
    walls: { h: [...(meta?.walls?.h ?? [])], v: [...(meta?.walls?.v ?? [])] },
  };
  const k = key(wall.x, wall.y);
  if (wall.o === 'h') {
    if (!next.walls.h.includes(k)) next.walls.h.push(k);
  } else {
    if (!next.walls.v.includes(k)) next.walls.v.push(k);
  }
  return next;
}

export function listLegalWallPlacements(
  state: GameStateEntity,
  actorId: number,
): CorridorWall[] {
  const meta = getMetadata(state);
  const remaining =
    (meta?.wallsRemainingByPlayerId ?? {})[String(actorId)] ?? 0;
  if (!remaining) return [];

  const size = meta?.size ?? 0;
  if (!size) return [];

  const results: CorridorWall[] = [];
  for (const o of ['h', 'v'] as const) {
    for (let y = 0; y <= size - 2; y++) {
      for (let x = 0; x <= size - 2; x++) {
        const wall = { x, y, o };
        if (!isWallPlacementInBounds(meta, wall)) continue;
        if (overlapsOrCrosses(meta, wall)) continue;
        if (wouldBlockAllPaths(state, meta, wall)) continue;
        results.push(wall);
      }
    }
  }
  return results;
}

export function validateMoveAction(
  state: GameStateEntity,
  action: GameSingleActionDto,
  actorId: number | null,
): { to: CorridorPos; actorId: number } {
  // Les bots ont des IDs négatifs dans l'état de jeu (GameCoreService),
  // donc on ne doit pas rejeter actorId <= 0 ici.
  if (actorId == null) {
    throw new GameActorRequiredError('Acteur requis');
  }
  if ((action?.type ?? '').trim() !== 'corridor_move') {
    throw new GameUnknownActionError(`Action inconnue: ${action?.type ?? ''}`);
  }

  const payload = (action.payload ?? {}) as CorridorMovePayload;
  const x = clampInt(payload?.x);
  const y = clampInt(payload?.y);

  const legal = listLegalPawnMoves(state, actorId).some(
    (p) => p.x === x && p.y === y,
  );
  if (!legal) {
    throw new GameActionRejectedError('Déplacement illégal');
  }

  return { to: { x, y }, actorId };
}

export function validatePlaceWallAction(
  state: GameStateEntity,
  action: GameSingleActionDto,
  actorId: number | null,
): { wall: CorridorWall; actorId: number } {
  // Les bots ont des IDs négatifs dans l'état de jeu (GameCoreService),
  // donc on ne doit pas rejeter actorId <= 0 ici.
  if (actorId == null) {
    throw new GameActorRequiredError('Acteur requis');
  }
  if ((action?.type ?? '').trim() !== 'corridor_place_wall') {
    throw new GameUnknownActionError(`Action inconnue: ${action?.type ?? ''}`);
  }

  const payload = (action.payload ?? {}) as CorridorPlaceWallPayload;
  const x = clampInt(payload?.x);
  const y = clampInt(payload?.y);
  const o = String(payload?.o ?? payload?.orientation ?? '')
    .trim()
    .toLowerCase();
  const orientation: CorridorWallOrientation =
    o === 'v' || o === 'vertical'
      ? 'v'
      : o === 'h' || o === 'horizontal'
        ? 'h'
        : (() => {
            throw new GamePayloadValidationError('Orientation invalide');
          })();

  const meta = getMetadata(state);
  const remaining =
    (meta?.wallsRemainingByPlayerId ?? {})[String(actorId)] ?? 0;
  if (remaining <= 0) {
    throw new GameActionRejectedError('Aucun mur restant.');
  }

  const wall: CorridorWall = { x, y, o: orientation };
  if (!isWallPlacementInBounds(meta, wall)) {
    throw new GamePayloadValidationError('Position de mur invalide.');
  }
  if (overlapsOrCrosses(meta, wall)) {
    throw new GameActionRejectedError('Mur invalide (chevauchement/croisement).');
  }
  if (wouldBlockAllPaths(state, meta, wall)) {
    throw new GameActionRejectedError('Mur invalide (bloque un chemin).');
  }

  return { wall, actorId };
}


